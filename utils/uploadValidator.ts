const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface ValidationResult {
  valid: boolean;
  errorMessage?: string;
}

export function validateImageFile(file: {
  mimeType?: string | null;
  fileSize?: number | null;
  uri?: string;
}): ValidationResult {
  if (file.mimeType && !ALLOWED_MIME_TYPES.includes(file.mimeType.toLowerCase())) {
    return {
      valid: false,
      errorMessage: 'Formato de arquivo não suportado. Use apenas JPG, PNG ou WebP.',
    };
  }

  if (file.fileSize && file.fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      errorMessage: 'O arquivo excede o limite máximo de 10MB.',
    };
  }

  return { valid: true };
}
