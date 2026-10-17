import { Routes, Route, Navigate, useParams } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import TokenAction from "./pages/TokenAction";
import NftAction from "./pages/NftAction";
import Verificate from "./pages/Verificate";
import Multisend from "./pages/Multisend";
import CapeToken from "./pages/CapeToken";
import Roadmap from "./pages/Roadmap";
import { PAGES } from "./lib/constants";
import "./App.css";

function TabRoute({ Page, base }) {
  const { tab } = useParams();
  const name = tab && tab[0].toUpperCase() + tab.slice(1).toLowerCase();
  if (!PAGES[name]) return <Navigate to={`${base}/lock`} replace />;
  return <Page tab={name} base={base} />;
}

export default function App() {
  return (
    <div className="app">
      <span className="arc arc--l" /><span className="arc arc--r" />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tokens" element={<Navigate to="/tokens/lock" replace />} />
        <Route path="/nft" element={<Navigate to="/nft/lock" replace />} />
        <Route path="/tokens/:tab" element={<TabRoute Page={TokenAction} base="/tokens" />} />
        <Route path="/nft/:tab" element={<TabRoute Page={NftAction} base="/nft" />} />
        <Route path="/verificate" element={<Verificate />} />
        <Route path="/multisend" element={<Multisend />} />
        <Route path="/cape" element={<CapeToken />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}