import { Platform, Share } from "react-native";

// Saves text as a file. In a web browser it downloads; on a phone it opens
// the share sheet (e.g. to email or save it).
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
  await Share.share({ title: filename, message: text });
}
