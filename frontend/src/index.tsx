import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { SchoolProvider } from "./contexts/SchoolContext";
import FeedbackHost from "./components/ui/FeedbackHost";
import { registerServiceWorker } from "./utils/pwa";

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <SchoolProvider>
    <App />
    <FeedbackHost />
  </SchoolProvider>
); 
