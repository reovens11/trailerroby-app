import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.trailerroby.app",
  appName: "TrailerRoby",
  webDir: "www",
  server: {
    url: "https://traileroby.com",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#030712",
  },
};

export default config;
