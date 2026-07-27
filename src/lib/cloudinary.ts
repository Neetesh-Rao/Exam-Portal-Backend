import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadVideoToCloudinary(base64DataUrl: string, folder: string = "proctoring_recordings"): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(base64DataUrl, {
      resource_type: "video",
      folder: folder,
      chunk_size: 6000000,
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary video upload error:", error);
    throw error;
  }
}
