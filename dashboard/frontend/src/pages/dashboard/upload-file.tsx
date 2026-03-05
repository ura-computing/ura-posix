import UploadWidget from "@/components/upload-widget";

export default function DashboardUploadFile() {
  return (
    <div className="upload-file-page">
      <UploadWidget value={null} onChange={() => {}} />
    </div>
  );
}
