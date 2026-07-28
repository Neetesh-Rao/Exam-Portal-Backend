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

  // Attempt 1: resource_type "video"
  try {
    const result = await cloudinary.uploader.upload(filePathOrData, {
      resource_type: "video",
      folder: folder,
    });
    console.log(`✅ Cloudinary video uploaded (video mode): ${result.secure_url}`);
    return result.secure_url;
  } catch (err1) {
    console.warn("Cloudinary upload (video) failed, retrying with auto mode...", err1);
    // Attempt 2: resource_type "auto"
    try {
      const result = await cloudinary.uploader.upload(filePathOrData, {
        resource_type: "auto",
        folder: folder,
      });
      console.log(`✅ Cloudinary video uploaded (auto mode): ${result.secure_url}`);
      return result.secure_url;
    } catch (err2) {
      console.warn("Cloudinary upload (auto) failed, retrying with raw mode...", err2);
      // Attempt 3: resource_type "raw"
      try {
        const result = await cloudinary.uploader.upload(filePathOrData, {
          resource_type: "raw",
          folder: folder,
        });
        console.log(`✅ Cloudinary video uploaded (raw mode): ${result.secure_url}`);
        return result.secure_url;
      } catch (err3) {
        console.error("Cloudinary video upload failed across all modes:", err3);
        throw err3;
      }
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
    console.error("Cloudinary image upload error, using fallback:", error);
    return base64OrPath;
  }
}
