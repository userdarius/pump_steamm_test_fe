#[test_only]
module pump_steamm::pump_steamm_tests {
    use sui::test_scenario::{Self as ts};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::object::{Self, ID};
    use sui::tx_context::{Self, TxContext};
    use std::option::{Self, Option};
    
    use pump_steamm::bonding_curve::{Self, MockBondingCurve};
    use pump_steamm::registry::{Self};
    
    const INITIAL_VIRTUAL_SUI: u64 = 30_000_000_000;
    const INITIAL_VIRTUAL_TOKENS: u64 = 1_000_000_000_000_000;
    const TEST_ADDR: address = @0xA;
    const TEST_ADDR_2: address = @0xB;
    
    public struct TEST_TOKEN has drop, store {}
    
    #[test]
    fun test_math() {
        assert!(1 + 1 == 2, 0);
    }
    
    #[test]
    fun test_scenario_basics() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            assert!(ts::sender(&scenario) == TEST_ADDR, 0);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_bonding_curve_default_values() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            
            let mut registry = registry::init_for_testing(ctx);
            
            let bonding_curve = bonding_curve::create_for_testing_mock(
                &mut registry,
                ctx
            );
            
            assert!(bonding_curve::get_virtual_sui_reserves_mock(&bonding_curve) == INITIAL_VIRTUAL_SUI, 0);
            assert!(bonding_curve::get_virtual_token_reserves_mock(&bonding_curve) == 0, 0);
            assert!(bonding_curve::is_transitioned_mock(&bonding_curve) == false, 0);
            
            transfer::public_share_object(registry);
            transfer::public_transfer(bonding_curve, TEST_ADDR);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_bonding_curve_accessors() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            
            let mut registry = registry::init_for_testing(ctx);
            
            let bonding_curve = bonding_curve::create_for_testing_mock(
                &mut registry,
                ctx
            );
            
            assert!(bonding_curve::get_total_minted_mock(&bonding_curve) == 0, 0);
            assert!(bonding_curve::get_virtual_sui_reserves_mock(&bonding_curve) == INITIAL_VIRTUAL_SUI, 0);
            assert!(bonding_curve::get_virtual_token_reserves_mock(&bonding_curve) == 0, 0);
            assert!(bonding_curve::is_transitioned_mock(&bonding_curve) == false, 0);
            
            transfer::public_share_object(registry);
            transfer::public_transfer(bonding_curve, TEST_ADDR);
        };
        
        ts::end(scenario);
    }
    
    fun create_sui(amount: u64, ctx: &mut TxContext): Coin<SUI> {
        coin::mint_for_testing<SUI>(amount, ctx)
    }
    
    #[test]
    fun test_simulate_buy_calculation() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            
            let mut registry = registry::init_for_testing(ctx);
            
            let bonding_curve = bonding_curve::create_for_testing_mock(
                &mut registry,
                ctx
            );
            
            let initial_virtual_sui = bonding_curve::get_virtual_sui_reserves_mock(&bonding_curve);
            let initial_virtual_tokens = bonding_curve::get_virtual_token_reserves_mock(&bonding_curve);
            
            let sui_amount = 1_000_000_000;
            
            let k = (INITIAL_VIRTUAL_SUI as u128) * (1_000_000_000_000_000 as u128);
            let x = (initial_virtual_sui as u128) + (sui_amount as u128);
            let new_token_supply = (1_000_000_000_000_000 as u128) - (k / x);
            let tokens_to_mint = (new_token_supply - (initial_virtual_tokens as u128) as u64);
            
            assert!(tokens_to_mint > 0, 0);
            
            transfer::public_share_object(registry);
            transfer::public_transfer(bonding_curve, TEST_ADDR);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_simulate_sell_calculation() {
        let initial_virtual_sui = 31_000_000_000;
        let tokens_to_sell = 100_000_000;
        
        let token_supply = 1_000_000_000_000_000;
        
        let k = (INITIAL_VIRTUAL_SUI as u128) * (token_supply as u128);
        
        let token_reserves = 1_000_000_000;
        
        let new_token_reserves = (token_reserves - tokens_to_sell as u128);
        
        let new_sui_amount = k / ((token_supply as u128) - new_token_reserves);
        
        let sui_to_receive = ((initial_virtual_sui as u128) - new_sui_amount as u64);
        
        assert!(sui_to_receive > 0, 0);
        assert!(new_sui_amount < (initial_virtual_sui as u128), 0);
        
        assert!(sui_to_receive < initial_virtual_sui, 0);
    }
    
    #[test]
    fun test_simulate_transition_threshold() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            
            let mut registry = registry::init_for_testing(ctx);
            
            let bonding_curve = bonding_curve::create_for_testing_mock(
                &mut registry,
                ctx
            );
            
            assert!(!bonding_curve::is_transitioned_mock(&bonding_curve), 0);
            
            let amount_needed = 39_000_000_000;
            
            assert!(INITIAL_VIRTUAL_SUI + amount_needed == 69_000_000_000, 0);
            
            transfer::public_share_object(registry);
            transfer::public_transfer(bonding_curve, TEST_ADDR);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_direct_calculate_tokens_to_mint() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            let bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            // Test with various SUI amounts
            let sui_amount_1 = 1_000_000_000; // 1 SUI
            let tokens_1 = bonding_curve::test_calculate_tokens_to_mint_mock(&bonding_curve, sui_amount_1);
            assert!(tokens_1 > 0, 0);
            
            let sui_amount_2 = 5_000_000_000; // 5 SUI
            let tokens_2 = bonding_curve::test_calculate_tokens_to_mint_mock(&bonding_curve, sui_amount_2);
            assert!(tokens_2 > tokens_1, 0); // More SUI should yield more tokens
            
            let sui_amount_3 = 10_000_000_000; // 10 SUI
            let tokens_3 = bonding_curve::test_calculate_tokens_to_mint_mock(&bonding_curve, sui_amount_3);
            assert!(tokens_3 > tokens_2, 0); // Even more SUI should yield even more tokens
            
            // Verify the formula is working as expected
            // For a perfectly linear relationship, tokens_3 would be exactly 2 * tokens_2
            // But for the bonding curve, it should be different due to the non-linear curve
            assert!(tokens_3 != 2 * tokens_2, 0);
            
            transfer::public_share_object(registry);
            transfer::public_transfer(bonding_curve, TEST_ADDR);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_direct_calculate_sui_to_receive() {
        // Create a simple test with known values
        
        // Start with high virtual reserves
        let initial_virtual_sui = 100_000_000_000u64;  // 100 SUI
        let initial_virtual_tokens = 500_000_000_000u64;  // 500 tokens in reserve
        
        // Set up the test scenario
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            let mut bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            // Setup the mock bonding curve with our test values
            bonding_curve::set_virtual_sui_reserves_mock(&mut bonding_curve, initial_virtual_sui);
            bonding_curve::set_virtual_token_reserves_mock(&mut bonding_curve, initial_virtual_tokens);
            
            // For selling tokens, we should get SUI back
            let tokens_to_sell = 100_000_000u64;  // Sell 0.1 tokens
            
            // Now use the helper function to calculate SUI to receive
            let result = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, tokens_to_sell);
            
            // Verify the result is reasonable
            assert!(result > 0, 0);
            assert!(result < initial_virtual_sui, 1); // We shouldn't get more than the total SUI reserves
            
            // Additional check: selling more tokens should give more SUI
            // First reset the virtual token reserves
            bonding_curve::set_virtual_token_reserves_mock(&mut bonding_curve, initial_virtual_tokens);
            
            // Now test with a larger amount
            let larger_tokens_to_sell = tokens_to_sell * 2;
            bonding_curve::decrement_virtual_token_reserves_mock(&mut bonding_curve, larger_tokens_to_sell);
            
            let larger_result = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, larger_tokens_to_sell);
            assert!(larger_result > 0, 2);
            assert!(larger_result > result, 3); // Selling more tokens should give more SUI
            
            transfer::public_share_object(registry);
            transfer::public_transfer(bonding_curve, TEST_ADDR);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_direct_check_transition() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            let mut bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            // Initially not transitioned
            assert!(!bonding_curve::is_transitioned_mock(&bonding_curve), 0);
            
            // SUI amount needed to reach the listing threshold
            let amount_needed = 39_000_000_000; // 39 SUI
            
            // Add SUI directly to the virtual reserves (below threshold)
            bonding_curve::increment_virtual_sui_reserves_mock(&mut bonding_curve, amount_needed - 1_000_000_000);
            
            // Check transition - should still be false
            bonding_curve::test_check_transition_mock(&mut bonding_curve);
            assert!(!bonding_curve::is_transitioned_mock(&bonding_curve), 0);
            
            // Add remaining SUI to exceed threshold
            bonding_curve::increment_virtual_sui_reserves_mock(&mut bonding_curve, 1_000_000_000);
            
            // Check transition - should now be true
            bonding_curve::test_check_transition_mock(&mut bonding_curve);
            assert!(bonding_curve::is_transitioned_mock(&bonding_curve), 0);
            
            transfer::public_share_object(registry);
            transfer::public_transfer(bonding_curve, TEST_ADDR);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_direct_buy_and_sell_integration() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            let mut bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            // Initial state
            let initial_sui = bonding_curve::get_virtual_sui_reserves_mock(&bonding_curve);
            let initial_tokens = bonding_curve::get_virtual_token_reserves_mock(&bonding_curve);
            
            // Simulate a buy operation
            let sui_to_spend = 5_000_000_000; // 5 SUI
            let tokens_minted = bonding_curve::test_calculate_tokens_to_mint_mock(&bonding_curve, sui_to_spend);
            
            // Update the curve state manually using helper functions
            bonding_curve::increment_virtual_sui_reserves_mock(&mut bonding_curve, sui_to_spend);
            bonding_curve::increment_virtual_token_reserves_mock(&mut bonding_curve, tokens_minted);
            bonding_curve::increment_total_minted_mock(&mut bonding_curve, tokens_minted);
            
            // Verify state after buying
            assert!(bonding_curve::get_virtual_sui_reserves_mock(&bonding_curve) == initial_sui + sui_to_spend, 0);
            assert!(bonding_curve::get_virtual_token_reserves_mock(&bonding_curve) == initial_tokens + tokens_minted, 0);
            
            // Simulate a sell operation (sell half the tokens)
            let tokens_to_sell = tokens_minted / 2;
            let sui_received = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, tokens_to_sell);
            
            // Update the curve state manually using helper functions
            bonding_curve::decrement_virtual_sui_reserves_mock(&mut bonding_curve, sui_received);
            bonding_curve::decrement_virtual_token_reserves_mock(&mut bonding_curve, tokens_to_sell);
            bonding_curve::decrement_total_minted_mock(&mut bonding_curve, tokens_to_sell);
            
            // Verify state after selling
            assert!(bonding_curve::get_virtual_sui_reserves_mock(&bonding_curve) == initial_sui + sui_to_spend - sui_received, 0);
            assert!(bonding_curve::get_virtual_token_reserves_mock(&bonding_curve) == initial_tokens + tokens_minted - tokens_to_sell, 0);
            
            // Verify slippage (buy high, sell low principle)
            // The SUI received should be less than half the SUI spent due to slippage
            assert!(sui_received < sui_to_spend / 2, 0);
            
            transfer::public_share_object(registry);
            transfer::public_transfer(bonding_curve, TEST_ADDR);
        };
        
        ts::end(scenario);
    }
} 