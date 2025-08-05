"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Save, ArrowLeft, Check, X } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../../store/store";
import { setUser } from "../../store/authSlice";
import { useApi } from "../../hooks/useApi";
import type {
  EmployeeData,
  EditableFields,
  GradientColors,
  ImageUploadState,
} from "../../types/EmployeeEditProfile.types";
import { DEFAULT_GRADIENT_COLORS } from "../../constant/EmployeeEditProfile.data";
import { AnimatedGradientBanner } from "../../components/EditProfile/AnimatedGradientBanner";
import { ProfileImageUpload } from "../../components/EditProfile/ProfileImageUpload";
import { EditableSection } from "../../components/EditProfile/EditableSection";
import { ReadOnlySection } from "../../components/EditProfile/ReadOnlySection";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ApiResponse } from "../../types/HrAttendance.type";

// Color extraction utility (simplified version)
const extractColorsFromImage = async (
  imageUrl: string
): Promise<GradientColors> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(DEFAULT_GRADIENT_COLORS);
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Simple color extraction - get dominant colors
        const colorCounts: { [key: string]: number } = {};

        for (let i = 0; i < data.length; i += 16) {
          // Sample every 4th pixel
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const alpha = data[i + 3];

          if (alpha > 128) {
            // Only consider non-transparent pixels
            const color = `rgb(${r},${g},${b})`;
            colorCounts[color] = (colorCounts[color] || 0) + 1;
          }
        }

        const sortedColors = Object.entries(colorCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([color]) => color);

        if (sortedColors.length >= 3) {
          resolve({
            primary: sortedColors[0],
            secondary: sortedColors[1],
            tertiary: sortedColors[2],
          });
        } else {
          resolve(DEFAULT_GRADIENT_COLORS);
        }
      } catch (error) {
        resolve(DEFAULT_GRADIENT_COLORS);
      }
    };

    img.onerror = () => {
      resolve(DEFAULT_GRADIENT_COLORS);
    };

    img.src = imageUrl;
  });
};

function EditProfile() {
  // Get user data from Redux store
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();

  // API call to get user profile data
  const { data, loading, error } = useApi<any>(
    "/admin/me",
    "GET"
  );

  console.log(data?.data);

  

  // Initialize state with user data from store
  const [employeeData, setEmployeeData] = useState<EmployeeData>(
    user || ({} as EmployeeData)
  );
  const [editableData, setEditableData] = useState<EditableFields>({
    name: data?.data?.name || "",
    email: data?.data?.email || "",
    phone: data?.data?.phone || "",
    dob: user?.dob || "",
    gender: data?.data?.gender || "Male",
    profile_image: data?.data?.profile_image || "",
  });
  const [originalData, setOriginalData] = useState<EditableFields>({
    name: data?.data?.name || "",
    email: data?.data?.email || "",
    phone: data?.data?.phone || "",
    dob: user?.dob || "",
    gender: data?.data?.gender || "Male",
    profile_image: data?.data?.profile_image || "",
  });

  const [gradientColors, setGradientColors] = useState<GradientColors>(
    DEFAULT_GRADIENT_COLORS
  );
  const [imageUploadState, setImageUploadState] = useState<ImageUploadState>({
    isUploading: false,
    error: null,
    preview: null,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof EditableFields, string>>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // API hook for updating profile
  const { run: updateProfile, loading: updateLoading } = useApi(
    "/employee/updateProfile",
    "PUT",
    { manual: true }
  );



  // Extract colors from profile image on component mount
  useEffect(() => {
    const extractColors = async () => {
      try {
        let imageUrl = `/images/user/UserSVG.svg`;

        // Use actual profile image if available
        if (data?.data?.profile_image) {
          const baseURL = import.meta.env.VITE_IMAGE_URL;
          imageUrl = `${baseURL}${data?.data?.profile_image}`;
        }

        const colors = await extractColorsFromImage(imageUrl);
        setGradientColors(colors);
      } catch (error) {
        console.error("Error extracting colors:", error);
        setGradientColors(DEFAULT_GRADIENT_COLORS);
      }
    };

    extractColors();
  }, [data?.data?.profile_image]);

  // Update local state when user data changes
  useEffect(() => {
    if (user) {
      const userData = {
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        dob: user.dob || "",
        gender: user.gender || "Male",
        profile_image: user.profile_image || "",
      };
      setEmployeeData(user);
      setEditableData(userData);
      setOriginalData(userData);
    }
  }, [user]);

  const handleFieldChange = useCallback(
    (field: keyof EditableFields, value: string) => {
      setEditableData((prev) => ({ ...prev, [field]: value }));

      // Clear error when user starts typing
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  const handleImageUpload = useCallback(async (file: File) => {
    setImageUploadState({
      isUploading: true,
      error: null,
      preview: null,
    });

    try {
      // Validate file
      if (!file.type.startsWith("image/")) {
        throw new Error("Please select a valid image file");
      }

      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        throw new Error("Image size should be less than 5MB");
      }

      // Create preview
      const preview = URL.createObjectURL(file);

      setImageUploadState({
        isUploading: false,
        error: null,
        preview,
      });

      // Store the file for upload
      setUploadedFile(file);

      // Extract colors from new image
      const colors = await extractColorsFromImage(preview);
      setGradientColors(colors);

      // Update editable data with file name
      setEditableData((prev) => ({ ...prev, profile_image: file.name }));
    } catch (error) {
      setImageUploadState({
        isUploading: false,
        error:
          error instanceof Error ? error.message : "Failed to upload image",
        preview: null,
      });
    }
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof EditableFields, string>> = {};

    if (!editableData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!editableData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editableData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!editableData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^\d{10}$/.test(editableData.phone.replace(/\D/g, ""))) {
      newErrors.phone = "Please enter a valid 10-digit phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: null, message: "" }), 5000);
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      // Prepare form data for file upload
      const formData = new FormData();

      // Add text fields
      formData.append("name", editableData.name);
      formData.append("email", editableData.email);
      formData.append("phone", editableData.phone);
      formData.append("dob", editableData.dob);
      formData.append("gender", editableData.gender);

      // Add profile image if uploaded
      if (uploadedFile) {
        formData.append("profile_image", uploadedFile);
      }

      // Make API call and get response data
      const response = await updateProfile(formData);

      // Use the API response data to update Redux and localStorage
      if (response && response.data) {
        const updatedUser = { ...user, ...response.data } as EmployeeData;
        
        // Update Redux store with API response data
        const token = localStorage.getItem("token") || "";
        dispatch(setUser({ user: updatedUser, token }));

        // Update localStorage with API response data
        localStorage.setItem("user", JSON.stringify(updatedUser));

        // Update local state with API response data
        setEmployeeData(updatedUser);
        
        // Update editable and original data with API response
        const newEditableData = {
          name: response.data.name || "",
          email: response.data.email || "",
          phone: response.data.phone || "",
          dob: response.data.dob || "",
          gender: response.data.gender || "Male",
          profile_image: response.data.profile_image || "",
        };
        
        setEditableData(newEditableData);
        setOriginalData(newEditableData);
      } else {
        // Fallback: use local data if API doesn't return updated data
        const updatedUser = { ...user, ...editableData } as EmployeeData;
        
        const token = localStorage.getItem("token") || "";
        dispatch(setUser({ user: updatedUser, token }));
        localStorage.setItem("user", JSON.stringify(updatedUser));
        
        setEmployeeData(updatedUser);
        setOriginalData(editableData);
      }

      // Clear uploaded file
      setUploadedFile(null);
      setImageUploadState((prev) => ({ ...prev, preview: null }));

      showNotification("success", "Profile updated successfully!");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      showNotification(
        "error",
        error?.message || "Failed to update profile. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = () => {
    return (
      JSON.stringify(editableData) !== JSON.stringify(originalData) ||
      uploadedFile !== null
    );
  };

  const handleCancel = () => {
    setEditableData(originalData);
    setUploadedFile(null);
    setImageUploadState((prev) => ({ ...prev, preview: null, error: null }));
    setErrors({});
  };

  const getProfileImageUrl = () => {
    if (imageUploadState.preview) {
      return imageUploadState.preview;
    }
    if (editableData.profile_image && !uploadedFile) {
      console.log(editableData);

      const baseURL = import.meta.env.VITE_IMAGE_URL;
      return `${baseURL}${editableData.profile_image}`;
    }
    return `/placeholder.svg?height=120&width=120&query=${encodeURIComponent(
      "profile picture"
    )}`;
  };

  return (
    <>
      <PageBreadcrumb pageTitle="Edit Profile" />
      <PageMeta
        title="HRMS | Edit Profile"
        description="Edit your profile information"
      />

      <div className="min-h-screen bg-gray-50">
        {/* Notification */}
        {notification.type && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 ${
              notification.type === "success"
                ? "bg-green-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {notification.type === "success" ? (
              <Check className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )}
            <span>{notification.message}</span>
          </motion.div>
        )}

        <div className="max-w-4xl mx-auto">
          {/* Header with action buttons */}
          <div className="flex justify-between items-center mb-8 pt-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
              <p className="text-gray-600 mt-2">
                Update your personal information
              </p>
            </div>
            <div className="flex space-x-3">
              {hasChanges() && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: hasChanges() ? 1.05 : 1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSave}
                disabled={!hasChanges() || isSaving}
                className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-all ${
                  hasChanges() && !isSaving
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8"
          >
            {/* Animated Gradient Banner */}
            <AnimatedGradientBanner colors={gradientColors}>
              <ProfileImageUpload
                currentImage={getProfileImageUrl()}
                onImageChange={handleImageUpload}
                uploadState={imageUploadState}
              />
            </AnimatedGradientBanner>

            {/* Profile Info */}
            <div className="px-6 py-8 text-center">
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-2xl font-bold text-gray-900 mb-2"
              >
                {editableData.name}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-gray-600"
              >
                {employeeData.designation} •{" "}
                {employeeData.department
                  ?.replace("-", " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </motion.p>
            </div>
          </motion.div>

          {/* Form Sections */}
          <div className="space-y-8 pb-8">
            <EditableSection
              data={editableData}
              onChange={handleFieldChange}
              errors={errors}
            />

            <ReadOnlySection data={employeeData} />
          </div>
        </div>
      </div>
    </>
  );
}

export default EditProfile;