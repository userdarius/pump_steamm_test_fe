#[test_only]
module pump_steamm::test_token {
    use std::option;
    use sui::coin::{Self, TreasuryCap, CoinMetadata};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    /// otw for the test token
    public struct TEST_TOKEN has drop {}

    fun init(witness: TEST_TOKEN, ctx: &mut TxContext) {

        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            9, // Decimals
            b"TEST",
            b"Test Token",
            b"Token for testing",
            option::none(),
            ctx
        );


        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
        transfer::public_transfer(metadata, tx_context::sender(ctx));
    }

    #[test_only]
    public fun get_test_treasury_cap(scenario: &mut sui::test_scenario::Scenario): (TreasuryCap<TEST_TOKEN>, CoinMetadata<TEST_TOKEN>) {
        use sui::test_scenario;
        
        let sender = test_scenario::sender(scenario);
        test_scenario::next_tx(scenario, sender);
        
        let treasury_cap = test_scenario::take_from_sender<TreasuryCap<TEST_TOKEN>>(scenario);
        let metadata = test_scenario::take_from_sender<CoinMetadata<TEST_TOKEN>>(scenario);
        
        (treasury_cap, metadata)
    }
} 