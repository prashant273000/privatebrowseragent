import { TokenVaultEntry } from './schemas';

export class TokenVault {
    private valueToToken = new Map<string, string>();
    private tokenToEntry = new Map<string, TokenVaultEntry>();
    private typeCounters = new Map<string, number>();

    public getToken(type: string, value: string): string {
        const key = `${type}:::${value}`;
        
        if (this.valueToToken.has(key)) {
            return this.valueToToken.get(key)!;
        }

        const count = (this.typeCounters.get(type) || 0) + 1;
        this.typeCounters.set(type, count);
        
        const token = `<${type}_${count}>`;
        
        this.valueToToken.set(key, token);
        this.tokenToEntry.set(token, { type, value });
        
        return token;
    }

    public getRawValue(token: string): string | undefined {
        return this.tokenToEntry.get(token)?.value;
    }
    
    public getAllRawValues(): string[] {
        return Array.from(this.tokenToEntry.values()).map(e => e.value);
    }
    
    public clear() {
        this.valueToToken.clear();
        this.tokenToEntry.clear();
        this.typeCounters.clear();
    }
}
