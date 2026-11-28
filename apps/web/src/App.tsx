import { DevicePage } from "./device/DevicePage.tsx";

function App() {
  return window.location.pathname === "/device" ? (
    <DevicePage />
  ) : (
    <h1>Rabi</h1>
  );
}

export default App;
