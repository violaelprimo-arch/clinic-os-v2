export function isProfilePhotoFolder(folder: string) {
  return folder === 'doctor_photos' || folder === 'hero'
}

export function imageLimitMB(folder: string) {
  return isProfilePhotoFolder(folder) ? 10 : 2
}
