import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import LoginForm from "../../components/auth/LoginForm";

export default function Login() {
  return (
    <>
      <PageMeta
        title="HRMS | Carnia Softlabs"
        description="HRMS"
      />
      <AuthLayout>
        <LoginForm />
      </AuthLayout>
    </>
  );
}
