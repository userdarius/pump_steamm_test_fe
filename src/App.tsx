import React from "react";
import { ConnectButton } from "@mysten/dapp-kit";
import BondingCurveInteraction from "./components/BondingCurveInteraction";

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Pump Steamm</h1>
          <ConnectButton />
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Bonding Curve Protocol</h2>
        </div>

        <BondingCurveInteraction />
      </main>

      <footer className="bg-gray-800 text-white p-4 mt-12">
        <div className="container mx-auto text-center">
          <p>Pump Steamm Protocol - Built on Sui</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
