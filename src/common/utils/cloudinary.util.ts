import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';

const logger = new Logger('CloudinaryUtil');

/**
 * Checks whether Cloudinary environment variables are configured.
 */
export function isCloudinaryConfigured(): boolean {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (cloudinaryUrl && cloudinaryUrl.trim().length > 0) {
    return true;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY || '932995489739298';
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  return Boolean(
    cloudName &&
    cloudName.trim().length > 0 &&
    apiKey &&
    apiKey.trim().length > 0 &&
    apiSecret &&
    apiSecret.trim().length > 0,
  );
}

/**
 * Initializes and configures the Cloudinary SDK using environment variables.
 */
export function configureCloudinary(): boolean {
  if (!isCloudinaryConfigured()) {
    return false;
  }

  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (cloudinaryUrl && cloudinaryUrl.trim().length > 0) {
    cloudinary.config({
      cloudinary_url: cloudinaryUrl.trim(),
      secure: true,
    });
    return true;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '932995489739298').trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return true;
  }

  return false;
}

/**
 * Uploads an image file from local disk to Cloudinary.
 * Returns the secure Cloudinary HTTPS URL upon success, or null if unconfigured/failed.
 */
export async function uploadToCloudinary(
  filePath: string,
  folder = 'hrms/profiles',
  publicId?: string,
): Promise<UploadApiResponse | null> {
  if (!isCloudinaryConfigured()) {
    return null;
  }

  const configured = configureCloudinary();
  if (!configured) {
    return null;
  }

  try {
    const uploadOptions: Record<string, any> = {
      folder,
      resource_type: 'image',
      overwrite: true,
      transformation: [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    logger.log(`Successfully uploaded image to Cloudinary: ${result.secure_url}`);
    return result;
  } catch (error) {
    logger.error('Failed to upload image to Cloudinary:', error);
    return null;
  }
}

/**
 * Deletes an image from Cloudinary by its public ID.
 */
export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  if (!isCloudinaryConfigured()) {
    return false;
  }

  configureCloudinary();

  try {
    const res = await cloudinary.uploader.destroy(publicId);
    return res?.result === 'ok';
  } catch (err) {
    logger.warn(`Failed to destroy Cloudinary asset ${publicId}:`, err);
    return false;
  }
}

export { cloudinary };

