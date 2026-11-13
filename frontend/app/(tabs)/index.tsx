import { useAuth } from "@/src/auth";
import { CaregiverHome } from "@/src/components/caregiver-home";
import { PatientHome } from "@/src/components/patient-home";

export default function Home() {
  const { user } = useAuth();
  return user?.role === "caregiver" ? <CaregiverHome /> : <PatientHome />;
}
