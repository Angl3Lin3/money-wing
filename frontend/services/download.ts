import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

// Saves text as a file. In a web browser it downloads. On a phone it writes
// a real file and opens the share sheet (Save to Files, Mail, AirDrop...).
export async function saveTextFile(filename: string, text: string, mimeType = "text/csv") {
  if (Platform.OS === "web") {
    const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  // The file goes in the app's temporary folder; the share sheet hands a
  // copy to wherever the owner chooses. The phone clears this folder itself.
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  await file.write(text);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle: filename,
      UTI: mimeType === "text/csv" ? "public.comma-separated-values-text" : "public.plain-text",
    });
    return;
  }
  // Very old devices without a share sheet for files: fall back to text.
  await Share.share({ title: filename, message: text });
}
