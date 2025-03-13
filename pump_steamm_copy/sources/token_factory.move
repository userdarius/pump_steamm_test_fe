module pump_steamm::token_factory {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    
    /// A counter that ensures each token witness is unique
    public struct TokenFactory has key {
        id: UID,
        next_token_id: u64
    }
    
    /// Error codes
    const EFactoryAlreadyExists: u64 = 1;
    
    /// Initialize the token factory - called once during deployment
    fun init(ctx: &mut TxContext) {
        let factory = TokenFactory {
            id: object::new(ctx),
            next_token_id: 0
        };
        
        // Make the factory a shared object
        transfer::share_object(factory);
    }
    
    /// Create a new unique token ID
    public fun create_new_token_id(factory: &mut TokenFactory): u64 {
        let token_id = factory.next_token_id;
        factory.next_token_id = factory.next_token_id + 1;
        token_id
    }
    
    /// Get the current next token ID without incrementing
    public fun get_next_token_id(factory: &TokenFactory): u64 {
        factory.next_token_id
    }
    
    /// Entry function to manually create a token factory (useful for testing or custom deployments)
    public entry fun create_shared_token_factory(ctx: &mut TxContext) {
        let factory = TokenFactory {
            id: object::new(ctx),
            next_token_id: 0
        };
        
        // Make the factory a shared object
        transfer::share_object(factory);
    }
    
    /// Test-only function to create a token factory
    #[test_only]
    public fun create_factory_for_testing(ctx: &mut TxContext): TokenFactory {
        TokenFactory {
            id: object::new(ctx),
            next_token_id: 0
        }
    }
    
    /// Test-only function to manually set the next token ID
    #[test_only]
    public fun set_next_token_id(factory: &mut TokenFactory, value: u64) {
        factory.next_token_id = value;
    }
    
    /// Test-only function to get the ID of a factory
    #[test_only]
    public fun get_factory_id(factory: &TokenFactory): ID {
        object::id(factory)
    }
} 