import { redirect } from "next/navigation";

export default function Reports() {
  redirect("/operation-documents/result?view=evidence");
}
