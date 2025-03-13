import React from "react";
import { ConnectButton } from "@mysten/dapp-kit";
import BondingCurveInteraction from "./components/BondingCurveInteraction";

const App: React.FC = () => {
  return (
    <div>
      <h1>Pump Steamm Copy Contract Testing</h1>
      <ConnectButton />
      <BondingCurveInteraction />
    </div>
  );
};

export default App;
