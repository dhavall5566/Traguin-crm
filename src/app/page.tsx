import { redirect } from "next/navigation";
import { CRM_LOGIN_PATH } from "@/lib/auth";

export default function Home() {
  redirect(CRM_LOGIN_PATH);
}
