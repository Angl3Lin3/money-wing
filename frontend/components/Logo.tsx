import { Image } from "react-native";

const LOGO = require("../assets/images/moneywing-logo.png");
const WING = require("../assets/images/moneywing-wing.png");

// Full MoneyWing logo (wing + "MoneyWing" + tagline).
export default function Logo({ width = 240 }: { width?: number }) {
  return (
    <Image
      source={LOGO}
      style={{ width, height: width * (619 / 749), alignSelf: "center" }}
      resizeMode="contain"
      accessibilityLabel="MoneyWing: Financial Literacy. Affordable Transfers"
    />
  );
}

// Just the wing, for small spaces like the header.
export function WingIcon({ size = 28 }: { size?: number }) {
  return (
    <Image
      source={WING}
      style={{ width: size * (239 / 440), height: size }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
