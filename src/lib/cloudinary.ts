import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "dm0zemnpb";
  const apiKey    = process.env.CLOUDINARY_API_KEY || "364913451751784";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "72cm36sl6qZXNiEPJeiD6QuIgUg";

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export async function uploadVideoToCloudinary(
  filePathOrData: string,
  folder: string = "proctoring_recordings"
): Promise<string> {
  configureCloudinary();
  try {
    const result = await cloudinary.uploader.upload(filePathOrData, {
      resource_type: "video",
      folder: folder,
    });
    console.log(`✅ Cloudinary video uploaded successfully: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.warn("Cloudinary video upload retry with auto resource_type...", error);
    try {
      const fallbackResult = await cloudinary.uploader.upload(filePathOrData, {
        resource_type: "auto",
        folder: folder,
      });
      console.log(`✅ Cloudinary video uploaded (auto fallback): ${fallbackResult.secure_url}`);
      return fallbackResult.secure_url;
    } catch (rawError) {
      console.error("Cloudinary video upload error details:", rawError);
      throw rawError;
    }
  }
}

export async function uploadImageToCloudinary(
  base64OrPath: string,
  folder: string = "bitmax_webcam_snapshots"
): Promise<string> {
  configureCloudinary();
  try {
    const result = await cloudinary.uploader.upload(base64OrPath, {
      resource_type: "image",
      folder: folder,
    });
    console.log(`✅ Cloudinary snapshot image uploaded: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary image upload error:", error);
    return base64OrPath; // Fallback to raw base64 if upload fails
  }
}
