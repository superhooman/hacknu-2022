import "../styles/globals.css";
import { Wrapper } from "@googlemaps/react-wrapper";
import type { AppType } from "next/dist/shared/lib/utils";
import { env } from "../env/client.mjs";

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <Wrapper apiKey={env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
      <Component {...pageProps} />
    </Wrapper>
  );
};

export default MyApp;
