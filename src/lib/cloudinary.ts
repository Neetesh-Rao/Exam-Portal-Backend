import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "dm0zemnpb";
  const apiKey = process.env.CLOUDINARY_API_KEY || "364913451751784";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "72cm36sl6qZXNiEPJeiD6QuIgUg";

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export async function uploadVideoToCloudinary(filePathOrData: string, folder: string = "proctoring_recordings"): Promise<string> {
  configureCloudinary();
  try {
    const result = await cloudinary.uploader.upload(filePathOrData, {
      resource_type: "raw",
      folder: folder,
    });
    console.log(`Cloudinary video uploaded successfully: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.warn("Cloudinary upload failed, retrying with explicit credentials...", error);
    try {
      cloudinary.config({
        cloud_name: "dm0zemnpb",
        api_key: "364913451751784",
        api_secret: "72cm36sl6qZXNiEPJeiD6QuIgUg",
        secure: true,
      });
      const rawResult = await cloudinary.uploader.upload(filePathOrData, {
        resource_type: "raw",
        folder: folder,
      });
      console.log(`Cloudinary video uploaded successfully (fallback mode): ${rawResult.secure_url}`);
      return rawResult.secure_url;
    } catch (rawError) {
      console.error("Cloudinary video upload error details:", rawError);
      throw rawError;
    }
  }
}
