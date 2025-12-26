const CONTRACT = 'paxi18wpg2d6t2cs5rfyg4nrxe4cuggtdp0yhx785qsz9jpgm3dawmanqwgkr59';
const RPC = 'https://mainnet-lcd.paxinet.io';
const DENOM = `factory/${CONTRACT}/dom`;
const DEV_WALLET = 'paxi1e4qjcey4dl23glwymrd9gscjeyy9r3hgydka0d';

// MEME TOKENS LIST - Tambahkan address token meme disini
const MEME_TOKENS = [
  { symbol: 'COBRA', address: 'paxi14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9snvcq0u' },
  { symbol: 'PICS', address: 'paxi1ltd0maxmte3xf4zshta9j5djrq9cl692ctsp9u5q0p9wss0f5lmsu3zxf3' },
  { symbol: 'PINET', address: 'paxi1l2fvuecjpakxxh6k0mhpxzeln2veqpjs7znm8mfavuwx506v0qnsmpnt55' },
  { symbol: 'ALPS', address: 'paxi1fka7t9avjmx7yphqxn3lzy3880tgcc0wu23xwfwxe5e5y3lkmzfqp07whx' },
  { symbol: 'LEO', address: 'paxi1fl9glyfffr8kewueguj6jsnex3whxrhn44ucsv7djgec6prdp7jqenytw2' },
  { symbol: 'ROON', address: 'paxi1nvnyaedrxtvhgxkdwghpr377vlg484asapf9j76pdxczw6y2dxvqlgtcey' }
];


// Tambahkan TX Hash asli dari Explorer ke dalam daftar manual sebagai cadangan pasti
const MANUAL_ACTIONS = [
{
  title: 'Liquidity Added',
  description: 'Initial liquidity added to PAXI swap pool',
  icon: 'fas fa-water',
  color: 'bg-cyan-500/20 text-cyan-400',
  timestamp: new Date().toISOString(),
  height: '2456781',
  txHash: '6A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z' // Ganti dengan hash asli
},
{
  title: 'Kingdom Established',
  description: 'MEME KING contract verified and initialized',
  icon: 'fas fa-crown',
  color: 'bg-yellow-500/20 text-yellow-400',
  timestamp: new Date(Date.now() - 86400000).toISOString(),
  height: '2451200',
  txHash: '1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z' // Ganti dengan hash asli
}];


const CFG = {
  contract: CONTRACT,
  rpc: RPC,
  denom: DENOM,
  devWallet: DEV_WALLET,
  name: 'DOM KING',
  symbol: 'DOM',
  desc: 'Supreme ruler of meme empire. Every meme profit flows back to strengthen the kingdom.',
  decimals: 6,
  paxiPrice: 0.02878039
};