import React from "react";
import { ConnectButton } from "@mysten/dapp-kit";
import BondingCurveInteraction from "./components/BondingCurveInteraction";

const App: React.FC = () => {
  return (
    <div
      style={{
        maxWidth: "1024px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "sans-serif",
      }}
    >
      <header
        style={{
          marginBottom: "30px",
          borderBottom: "1px solid #eaeaea",
          paddingBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              margin: 0,
            }}
          >
            Pump Steamm
          </h1>
          <div>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main>
        <div>
          <div
            style={{
              textAlign: "center",
              marginBottom: "40px",
            }}
          >
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                marginBottom: "16px",
              }}
            >
              Bonding Curve Protocol
            </h2>
            <p
              style={{
                fontSize: "16px",
                maxWidth: "600px",
                margin: "0 auto",
                color: "#4b5563",
              }}
            >
              Interact with bonding curves to buy and sell tokens on Sui. Create
              new tokens and trade on the decentralized curve.
            </p>
          </div>

          <BondingCurveInteraction />
        </div>
      </main>
    </div>
  );
};

export default App;
