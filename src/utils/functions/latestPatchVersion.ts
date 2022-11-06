import axios from "axios";

export async function getLatestPoEPatch(): Promise<string> {
  const res = await axios(
    "https://raw.githubusercontent.com/poe-tool-dev/latest-patch-version/main/latest.txt"
  );
  const version = res.data as string;
  return version;
}
