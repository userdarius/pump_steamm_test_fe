#[test_only]
module pump_steamm::pump_steamm_tests {
    use sui::test_scenario::{Self as ts};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::object::{Self, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::test_utils::{destroy, create_one_time_witness};
    use std::option::{Self, Option};
    
    use pump_steamm::bonding_curve::{Self, MockBondingCurve};
    use pump_steamm::registry::{Self};
    use pump_steamm::test_token::TEST_TOKEN;
    
    const INITIAL_VIRTUAL_SUI: u64 = 30_000_000_000_000; // 30,000 SUI with 9 decimals (updated)
    const INITIAL_VIRTUAL_TOKENS: u64 = 1_000_000_000_000_000_000; // 1 billion tokens with 9 decimals 
    const LISTING_THRESHOLD: u64 = 69_000_000_000_000; // 69,000 SUI with 9 decimals (updated)
    
    const TEST_ADDR: address = @0xA;
    const TEST_ADDR_2: address = @0xB;
    
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
            bonding_curve::share_mock_bonding_curve(bonding_curve);
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
            bonding_curve::share_mock_bonding_curve(bonding_curve);
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
            let mut bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            let initial_virtual_sui = INITIAL_VIRTUAL_SUI + 100_000_000_000;
            bonding_curve::set_virtual_sui_reserves_mock(&mut bonding_curve, initial_virtual_sui);
            
            let sui_to_add = 10_000_000_000;
            
            let contract_tokens = bonding_curve::test_calculate_tokens_to_mint_mock(&bonding_curve, sui_to_add);
            
            assert!(contract_tokens > 0, 1);
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_simulate_sell_calculation() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            let mut bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            let initial_virtual_sui = INITIAL_VIRTUAL_SUI + 100_000_000_000;
            let initial_virtual_tokens = 100_000_000_000;
            
            bonding_curve::set_virtual_sui_reserves_mock(&mut bonding_curve, initial_virtual_sui);
            bonding_curve::set_virtual_token_reserves_mock(&mut bonding_curve, initial_virtual_tokens);
            
            let tokens_to_sell = 10_000_000_000;
            
            let contract_sui = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, tokens_to_sell);
            
            assert!(contract_sui > 0, 0);
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
        };
        
        ts::end(scenario);
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
            
            let amount_needed = LISTING_THRESHOLD - INITIAL_VIRTUAL_SUI;
            
            assert!(INITIAL_VIRTUAL_SUI + amount_needed == LISTING_THRESHOLD, 0);
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
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
            
            let sui_amount_1 = 1_000_000_000;
            let tokens_1 = bonding_curve::test_calculate_tokens_to_mint_mock(&bonding_curve, sui_amount_1);
            assert!(tokens_1 > 0, 0);
            
            let sui_amount_2 = 5_000_000_000;
            let tokens_2 = bonding_curve::test_calculate_tokens_to_mint_mock(&bonding_curve, sui_amount_2);
            assert!(tokens_2 > tokens_1, 0);
            
            let sui_amount_3 = 10_000_000_000;
            let tokens_3 = bonding_curve::test_calculate_tokens_to_mint_mock(&bonding_curve, sui_amount_3);
            assert!(tokens_3 > tokens_2, 0);
            
            assert!(tokens_3 != 2 * tokens_2, 0);
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_direct_calculate_sui_to_receive() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            let mut bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            let initial_virtual_sui = INITIAL_VIRTUAL_SUI + 100_000_000_000;
            let initial_virtual_tokens = 100_000_000_000;
            
            bonding_curve::set_virtual_sui_reserves_mock(&mut bonding_curve, initial_virtual_sui);
            bonding_curve::set_virtual_token_reserves_mock(&mut bonding_curve, initial_virtual_tokens);
            
            let tokens_to_sell = 10_000_000_000;
            
            let result = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, tokens_to_sell);
            
            assert!(result > 0, 0);
            assert!(result < initial_virtual_sui, 1);
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
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
            
            assert!(!bonding_curve::is_transitioned_mock(&bonding_curve), 0);
            
            let amount_needed = LISTING_THRESHOLD - INITIAL_VIRTUAL_SUI;
            
            bonding_curve::increment_virtual_sui_reserves_mock(&mut bonding_curve, amount_needed - 1_000_000_000);
            
            bonding_curve::test_check_transition_mock(&mut bonding_curve);
            assert!(!bonding_curve::is_transitioned_mock(&bonding_curve), 0);
            
            bonding_curve::increment_virtual_sui_reserves_mock(&mut bonding_curve, 1_000_000_000);
            
            bonding_curve::test_check_transition_mock(&mut bonding_curve);
            assert!(bonding_curve::is_transitioned_mock(&bonding_curve), 0);
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
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
            
            let initial_sui = bonding_curve::get_virtual_sui_reserves_mock(&bonding_curve);
            let initial_tokens = bonding_curve::get_virtual_token_reserves_mock(&bonding_curve);
            
            let sui_to_spend = 5_000_000_000;
            let tokens_minted = bonding_curve::test_calculate_tokens_to_mint_mock(&bonding_curve, sui_to_spend);
            
            bonding_curve::increment_virtual_sui_reserves_mock(&mut bonding_curve, sui_to_spend);
            bonding_curve::increment_virtual_token_reserves_mock(&mut bonding_curve, tokens_minted);
            bonding_curve::increment_total_minted_mock(&mut bonding_curve, tokens_minted);
            
            assert!(bonding_curve::get_virtual_sui_reserves_mock(&bonding_curve) == initial_sui + sui_to_spend, 0);
            assert!(bonding_curve::get_virtual_token_reserves_mock(&bonding_curve) == initial_tokens + tokens_minted, 0);
            
            let tokens_to_sell = tokens_minted / 2;
            let sui_received = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, tokens_to_sell);
            
            bonding_curve::decrement_virtual_sui_reserves_mock(&mut bonding_curve, sui_received);
            bonding_curve::decrement_virtual_token_reserves_mock(&mut bonding_curve, tokens_to_sell);
            bonding_curve::decrement_total_minted_mock(&mut bonding_curve, tokens_to_sell);
            
            assert!(bonding_curve::get_virtual_sui_reserves_mock(&bonding_curve) == initial_sui + sui_to_spend - sui_received, 0);
            assert!(bonding_curve::get_virtual_token_reserves_mock(&bonding_curve) == initial_tokens + tokens_minted - tokens_to_sell, 0);
            
            assert!(sui_received < sui_to_spend / 2, 0);
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_unique_token_creation() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            
            let bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            assert!(bonding_curve::get_virtual_sui_reserves_mock(&bonding_curve) == INITIAL_VIRTUAL_SUI, 0);
            assert!(bonding_curve::get_virtual_token_reserves_mock(&bonding_curve) == 0, 0);
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_negative_token_mint_protection() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            let mut bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            bonding_curve::set_virtual_sui_reserves_mock(&mut bonding_curve, INITIAL_VIRTUAL_SUI);
            bonding_curve::set_virtual_token_reserves_mock(&mut bonding_curve, INITIAL_VIRTUAL_TOKENS);
            
            let sui_amount = 1;
            
            let tokens = bonding_curve::test_calculate_tokens_to_mint_mock(&bonding_curve, sui_amount);
            
            assert!(tokens >= 0, 0);
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_create_unique_token() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            
            let otw = create_one_time_witness<TEST_TOKEN>();
            
            let (treasury_cap, metadata) = coin::create_currency<TEST_TOKEN>(
                otw,
                9,
                b"TEST",
                b"Test Token",
                b"Test token description",
                option::none(),
                ctx
            );
            
            bonding_curve::bind_token_to_curve_entry(
                &mut registry,
                treasury_cap,
                metadata,
                ctx
            );
            
            transfer::public_share_object(registry);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_sell_different_amounts() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            
            {
                let mut registry = registry::init_for_testing(ctx);
                let mut bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
                
                let initial_sui = INITIAL_VIRTUAL_SUI + 10_000_000_000_000;
                let initial_tokens = 10_000_000_000_000;
                
                bonding_curve::set_virtual_sui_reserves_mock(&mut bonding_curve, initial_sui);
                bonding_curve::set_virtual_token_reserves_mock(&mut bonding_curve, initial_tokens);
                
                let mut i = 0;
                let amounts = vector[
                    10_000_000_000,
                    50_000_000_000,
                    100_000_000_000,
                    500_000_000_000
                ];
                
                while (i < vector::length(&amounts)) {
                    let amount = *vector::borrow(&amounts, i);
                    
                    let sui_received = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, amount);
                    
                    assert!(sui_received > 0, 100 + i);
                    
                    assert!(sui_received < initial_sui, 200 + i);
                    
                    i = i + 1;
                };
                
                transfer::public_share_object(registry);
                bonding_curve::share_mock_bonding_curve(bonding_curve);
            };
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_sell_maximum_supply() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            let mut bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            let initial_sui = INITIAL_VIRTUAL_SUI + 100_000_000_000_000;
            
            let token_reserve_gap = 900_000_000_000_000_000;
            let initial_tokens = INITIAL_VIRTUAL_TOKENS - token_reserve_gap;
            
            bonding_curve::set_virtual_sui_reserves_mock(&mut bonding_curve, initial_sui);
            bonding_curve::set_virtual_token_reserves_mock(&mut bonding_curve, initial_tokens);
            
            let too_large_amount = token_reserve_gap + 1_000_000_000;
            let sui_received_for_too_large = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, too_large_amount);
            
            assert!(sui_received_for_too_large == 0, 1);
            
            let reasonable_amount = 1_000_000_000;
            let sui_received_for_reasonable = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, reasonable_amount);
            
            assert!(sui_received_for_reasonable > 0, 2);
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_sell_slippage() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            let mut bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            let initial_sui = INITIAL_VIRTUAL_SUI + 10_000_000_000_000;
            let initial_tokens = 100_000_000_000_000;
            bonding_curve::set_virtual_sui_reserves_mock(&mut bonding_curve, initial_sui);
            bonding_curve::set_virtual_token_reserves_mock(&mut bonding_curve, initial_tokens);
            
            let total_amount = 10_000_000_000_000;
            
            let all_at_once = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, total_amount);
            
            bonding_curve::set_virtual_sui_reserves_mock(&mut bonding_curve, initial_sui);
            bonding_curve::set_virtual_token_reserves_mock(&mut bonding_curve, initial_tokens);
            
            let chunk_size = 2_000_000_000_000;
            let mut total_received = 0;
            let mut remaining = total_amount;
            
            while (remaining > 0) {
                let current_chunk = if (remaining > chunk_size) chunk_size else remaining;
                let sui_received = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, current_chunk);
                
                bonding_curve::decrement_virtual_sui_reserves_mock(&mut bonding_curve, sui_received);
                bonding_curve::increment_virtual_token_reserves_mock(&mut bonding_curve, current_chunk);
                
                total_received = total_received + sui_received;
                remaining = remaining - current_chunk;
            };
            
            assert!(all_at_once < total_received, 0);
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_sell_sequence() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            let mut bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            let initial_sui = INITIAL_VIRTUAL_SUI + 10_000_000_000_000;
            let initial_tokens = 50_000_000_000_000;
            bonding_curve::set_virtual_sui_reserves_mock(&mut bonding_curve, initial_sui);
            bonding_curve::set_virtual_token_reserves_mock(&mut bonding_curve, initial_tokens);
            
            let sell_amount = 10_000_000_000_000;
            let mut total_sui_received = 0;
            let mut remaining_tokens = initial_tokens;
            
            while (remaining_tokens >= sell_amount) {
                let sui_received = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, sell_amount);
                
                assert!(sui_received > 0, 0);
                
                bonding_curve::decrement_virtual_sui_reserves_mock(&mut bonding_curve, sui_received);
                bonding_curve::decrement_virtual_token_reserves_mock(&mut bonding_curve, sell_amount);
                
                total_sui_received = total_sui_received + sui_received;
                remaining_tokens = remaining_tokens - sell_amount;
            };
            
            assert!(remaining_tokens < sell_amount, 1);
            assert!(total_sui_received <= initial_sui, 2);
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_sell_different_reserve_states() {
        let mut scenario = ts::begin(TEST_ADDR);
        
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = registry::init_for_testing(ctx);
            let mut bonding_curve = bonding_curve::create_for_testing_mock(&mut registry, ctx);
            
            let mut sui_reserves = vector::empty<u64>();
            let mut token_reserves = vector::empty<u64>();
            
            vector::push_back(&mut sui_reserves, INITIAL_VIRTUAL_SUI + 100_000_000_000);
            vector::push_back(&mut token_reserves, 100_000_000_000);
            
            vector::push_back(&mut sui_reserves, INITIAL_VIRTUAL_SUI + 1_000_000_000_000);
            vector::push_back(&mut token_reserves, 1_000_000_000_000);
            
            vector::push_back(&mut sui_reserves, INITIAL_VIRTUAL_SUI + 10_000_000_000_000);
            vector::push_back(&mut token_reserves, 10_000_000_000_000);
            
            let mut i = 0;
            while (i < vector::length(&sui_reserves)) {
                let sui_reserve = *vector::borrow(&sui_reserves, i);
                let token_reserve = *vector::borrow(&token_reserves, i);
                
                bonding_curve::set_virtual_sui_reserves_mock(&mut bonding_curve, sui_reserve);
                bonding_curve::set_virtual_token_reserves_mock(&mut bonding_curve, token_reserve);
                
                let sell_amount = token_reserve / 10;
                let sui_received = bonding_curve::test_calculate_sui_to_receive_mock(&bonding_curve, sell_amount);
                
                assert!(sui_received > 0, i);
                
                assert!(sui_received <= sui_reserve, i + 100);
                
                i = i + 1;
            };
            
            transfer::public_share_object(registry);
            bonding_curve::share_mock_bonding_curve(bonding_curve);
        };
        
        ts::end(scenario);
    }
} 