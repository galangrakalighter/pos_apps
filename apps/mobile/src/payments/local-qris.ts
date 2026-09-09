import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const keyFor = (mitraId: string) => `qris_image_${mitraId}`;

export async function getLocalQrisImage(mitraId: string): Promise<string | null> {
  return SecureStore.getItemAsync(keyFor(mitraId));
}

export async function saveLocalQrisImage(
  mitraId: string,
  asset: { uri: string; mimeType?: string | null; fileName?: string | null },
): Promise<string> {
  if (!asset.uri || !FileSystem.documentDirectory) throw new Error('Gambar QRIS tidak valid');
  const extension = asset.mimeType === 'image/png' ? 'png' : asset.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const directory = `${FileSystem.documentDirectory}qris/`;
  const previous = await SecureStore.getItemAsync(keyFor(mitraId));
  // URI baru memaksa React Native melepas cache gambar QRIS sebelumnya.
  const destination = `${directory}${mitraId}-${Crypto.randomUUID()}.${extension}`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.copyAsync({ from: asset.uri, to: destination });
  await SecureStore.setItemAsync(keyFor(mitraId), destination);
  if (previous && previous !== destination && previous.startsWith(directory)) {
    await FileSystem.deleteAsync(previous, { idempotent: true }).catch(() => undefined);
  }
  return destination;
}
