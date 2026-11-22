import { WebView } from "react-native-webview";
import { isAllowedUrl } from "../utils/validators";

// Liste blanche des actions acceptées depuis la page web.
const ALLOWED_ACTIONS = ["close", "share"];

export default function ArticleScreen({ onClose }: { onClose: () => void }) {
  return (
    <WebView
      source={{ uri: "https://santeplus.ma/articles" }}
      originWhitelist={["https://santeplus.ma"]}
      onShouldStartLoadWithRequest={(req) => isAllowedUrl(req.url)}
      onMessage={(event) => {
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          if (!ALLOWED_ACTIONS.includes(msg.action)) return;
          if (msg.action === "close") onClose();
        } catch {
          // Message invalide : ignoré.
        }
      }}
    />
  );
}
