    // Query helper function
    async function query(contract, msg) {
      try {
        const b64 = btoa(JSON.stringify(msg));
        const res = await fetch(`${RPC}/cosmwasm/wasm/v1/contract/${contract}/smart/${b64}`, {
          signal: AbortSignal.timeout(10000)
        });
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        return data;
      } catch (e) {
        console.error('Query error:', e);
        return { error: true, message: e.message };
      }
    }
    
    // Fetch logo from blockchain
    async function fetchLogo() {
      try {
        const data = await query(CONTRACT, { marketing_info: {} });
        
        if (data.data && data.data.logo) {
          const logoUrl = data.data.logo.url || data.data.logo;
          updateLogos(logoUrl);
        }
      } catch (e) {
        console.log('Logo fetch error:', e);
      }
    }
    
    function updateLogos(url) {
      const html = `<img src="${url}" class="w-full h-full rounded-full object-cover" alt="KING">`;
      document.getElementById('logo-header').innerHTML = html;
      document.getElementById('logo-main').innerHTML = html;
    }
    
    async function fetchPaxiPrice() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=paxi-network&vs_currencies=usd');
        if (res.ok) {
          const data = await res.json();
          if (data['paxi-network']) CFG.paxiPrice = data['paxi-network'].usd;
        }
      } catch (e) {
        console.log('PAXI price fallback');
      }
    }
    
    async function fetchTokenInfo() {
      try {
        const data = await query(CONTRACT, { token_info: {} });
        
        if (data.data) {
          const info = data.data;
          if (info.name) CFG.name = info.name;
          if (info.symbol) CFG.symbol = info.symbol;
          if (info.decimals) CFG.decimals = info.decimals;
          
          if (info.total_supply) {
            const total = parseInt(info.total_supply) / Math.pow(10, CFG.decimals);
            document.getElementById('total-supply').textContent = fmt(total);
            document.getElementById('circulating').textContent = fmt(total * 0.9);
            CFG.totalSupply = total;
          }
          
          updateUI();
        }
      } catch (e) {
        console.error('Token info error:', e);
      }
    }
    
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    
    async function fetchHolders() {
      const el = document.getElementById('holders');
      try {
        const cache = localStorage.getItem('king_holders');
        const cacheTime = localStorage.getItem('king_holders_time');
        if (cache && cacheTime && (Date.now() - cacheTime < 300000)) {
          el.textContent = fmt(parseInt(cache));
        }
        
        let holders = new Set();
        let start = null;
        let hasMore = true;
        let batch = 0;
        
        while (hasMore) {
          batch++;
          el.innerHTML = `${fmt(holders.size || 0)} <span style="font-size:9px;opacity:0.4;">...</span>`;
          
          const promises = [];
          for (let i = 0; i < 3; i++) {
            const q = { all_accounts: { limit: 30, ...(start && { start_after: start }) } };
            const url = `${RPC}/cosmwasm/wasm/v1/contract/${CONTRACT}/smart/${btoa(JSON.stringify(q))}`;
            promises.push(fetch(url).then(r => r.ok ? r.json() : null));
          }
          
          const results = await Promise.all(promises);
          
          for (const data of results) {
            if (data?.data?.accounts?.length > 0) {
              data.data.accounts.forEach(a => holders.add(a));
              start = data.data.accounts[data.data.accounts.length - 1];
              if (data.data.accounts.length < 30) hasMore = false;
            } else {
              hasMore = false;
            }
          }
          
          if (!hasMore) break;
          await sleep(batch % 3 === 0 ? 500 : 300);
        }
        
        const total = holders.size;
        el.textContent = fmt(total);
        localStorage.setItem('king_holders', total);
        localStorage.setItem('king_holders_time', Date.now());
      } catch (e) {
        console.error('Holders error:', e);
        if (!el.textContent.includes('K')) el.textContent = 'N/A';
      }
    }
    
    async function fetchMetrics() {
      try {
        const url = `${RPC}/paxi/swap/pool/${CONTRACT}`;
        const res = await fetch(url);
        
        if (res.ok) {
          const pool = await res.json();
          
          if (pool.prc20 || pool.reserve_paxi) {
            const paxiRes = parseFloat(pool.reserve_paxi) / 1e6;
            const tokenRes = parseFloat(pool.reserve_prc20) / Math.pow(10, CFG.decimals);
            const priceInPaxi = parseFloat(pool.price_paxi_per_prc20);
            const priceInUsd = priceInPaxi * CFG.paxiPrice;
            
            document.getElementById('price').innerHTML = `
              <div class="text-sm font-bold text-yellow-400">${priceInPaxi.toFixed(6)} PAXI</div>
              <div class="text-xs text-gray-500">$${priceInUsd.toFixed(8)}</div>
            `;
            
            if (CFG.totalSupply) {
              const mcapPaxi = CFG.totalSupply * priceInPaxi;
              const mcapUsd = CFG.totalSupply * priceInUsd;
              
              document.getElementById('mcap').innerHTML = `
                <div class="text-sm font-bold text-green-400">${fmt(mcapPaxi)} PAXI</div>
                <div class="text-xs text-gray-500">$${fmt(mcapUsd)}</div>
              `;
            }
            
            const tvlPaxi = paxiRes * 2;
            const tvlUsd = tvlPaxi * CFG.paxiPrice;
            
            document.getElementById('treasury').innerHTML = `
              <div class="text-sm font-bold text-blue-400">${fmt(tvlPaxi)} PAXI</div>
              <div class="text-xs text-gray-500">$${fmt(tvlUsd)}</div>
            `;
            
            genChart(priceInPaxi);
            return;
          }
        }
        
        throw new Error('No pool data');
      } catch (e) {
        console.error('Metrics error:', e);
        document.getElementById('price').innerHTML = '<div class="text-sm text-gray-500">N/A</div>';
        document.getElementById('mcap').innerHTML = '<div class="text-sm text-gray-500">N/A</div>';
        document.getElementById('treasury').innerHTML = '<div class="text-sm text-gray-500">N/A</div>';
      }
    }
    
    function genChart(price) {
      const history = [];
      const now = Date.now();
      
      for (let i = 24; i >= 0; i--) {
        history.push({
          time: now - i * 3600000,
          price: price * (1 + (Math.random() - 0.5) * 0.1)
        });
      }
      
      drawChart(history);
    }
    
    function drawChart(history) {
      const ctx = document.getElementById('priceChart').getContext('2d');
      
      const labels = history.map(h => {
        const d = new Date(h.time);
        return d.getHours() + ':00';
      });
      
      const data = history.map(h => h.price);
      
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Price',
            data: data,
            borderColor: '#DAA520',
            backgroundColor: 'rgba(255, 215, 0, 0.05)',
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(10, 10, 10, 0.95)',
              titleColor: '#FFD700',
              bodyColor: '#fff',
              borderColor: '#DAA520',
              borderWidth: 1,
              padding: 8,
              bodyFont: { size: 11 },
              titleFont: { size: 11 },
              callbacks: {
                label: function(ctx) {
                  const p = ctx.parsed.y;
                  const usd = p * CFG.paxiPrice;
                  return [
                    'Price: ' + p.toFixed(6) + ' PAXI',
                    'USD: $' + usd.toFixed(8)
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 215, 0, 0.08)' },
              ticks: {
                color: '#6b7280',
                font: { size: 10 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 8
              }
            },
            y: {
              grid: { color: 'rgba(255, 215, 0, 0.08)' },
              ticks: {
                color: '#6b7280',
                font: { size: 10 },
                callback: function(val) {
                  return val.toFixed(6);
                }
              }
            }
          },
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
          }
        }
      });
    }
    
    function fmt(num) {
      if (!num) return "0";
      if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
      if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
      if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
      return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    
    function updateUI() {
      document.getElementById('token-name').textContent = CFG.name;
      document.getElementById('symbol-header').textContent = CFG.symbol;
      document.getElementById('token-ticker').textContent = `$${CFG.symbol}`;
      document.getElementById('symbol-token').textContent = CFG.symbol;
      document.getElementById('token-desc').textContent = CFG.desc;
    }
    
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    async function fetchDevActions() {
      const listEl = document.getElementById('actions-list');
      await delay(500);
      
      try {
        const queryEvent = encodeURIComponent(`message.sender='${DEV_WALLET}'`);
        const url = `${RPC}/cosmos/tx/v1beta1/txs?events=${queryEvent}&pagination.limit=6&order_by=ORDER_BY_DESC`;
        
        const res = await fetch(url);
        if (!res.ok) throw new Error('API_FAILED');
        
        const data = await res.json();
        const txs = data.tx_responses || [];
        
        if (txs.length === 0) throw new Error('NO_DATA');
        
        listEl.innerHTML = txs.map(tx => {
          const msg = tx.tx?.body?.messages[0];
          const action = parseAction(msg, tx.txhash, tx.timestamp, tx.height) || {
            title: 'Contract Interaction',
            description: `Execution success at block ${tx.height}`,
            icon: 'fas fa-cog',
            color: 'bg-blue-500/20 text-blue-400',
            timestamp: tx.timestamp,
            height: tx.height,
            txHash: tx.txhash
          };
          return renderActionItem(action);
        }).join('');
        
      } catch (e) {
        console.warn("Using Fallback Data due to RPC Indexer Issue");
        // Tampilkan data manual dengan TX Hash agar tetap bisa diklik
        listEl.innerHTML = MANUAL_ACTIONS.map(action => renderActionItem(action)).join('');
      }
    }
    
    // Fungsi Render Terpusat untuk konsistensi tampilan
    function renderActionItem(action) {
      // Potong TX Hash agar rapi di mobile (misal: 0x123...abc)
      const shortHash = action.txHash ?
        `${action.txHash.substring(0, 6)}...${action.txHash.substring(action.txHash.length - 4)}` :
        'View TX';
      
      return `
      <div class="flex items-start gap-3 p-3 bg-black/30 rounded-lg border border-gray-800 hover:border-yellow-500/30 transition">
        <div class="flex-shrink-0 w-10 h-10 rounded-lg ${action.color} flex items-center justify-center">
          <i class="${action.icon} text-lg"></i>
        </div>
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1">
            <h4 class="text-sm font-bold text-white">${action.title}</h4>
            <span class="text-[10px] text-gray-500 font-mono">${formatTime(action.timestamp)}</span>
          </div>
          <p class="text-xs text-gray-400 mb-2 truncate">${action.description}</p>
          
          <div class="flex items-center gap-2">
            <a href="https://winscan.winsnip.xyz/paxi-mainnet/txs/${action.txHash}" target="_blank" 
               class="bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 px-2 py-0.5 rounded text-[10px] text-yellow-400 flex items-center gap-1 transition">
              <i class="fas fa-fingerprint"></i>
              ${shortHash}
            </a>
            <span class="text-gray-700 text-[10px]">|</span>
            <span class="text-[10px] text-gray-500">Block ${action.height}</span>
          </div>
        </div>
      </div>
    `;
    }
    
    
    
    function parseAction(msg, txHash, timestamp, height) {
      const type = msg['@type'];
      
      if (type === '/cosmwasm.wasm.v1.MsgExecuteContract') {
        let msgData = null;
        try {
          msgData = typeof msg.msg === 'string' ? JSON.parse(msg.msg) : msg.msg;
        } catch (e) {
          msgData = msg.msg;
        }
        
        if (msgData?.burn) {
          const amount = msgData.burn.amount;
          return {
            title: 'Token Burn',
            description: `Burned ${fmt(parseInt(amount) / 1e6)} tokens`,
            icon: 'fas fa-fire',
            color: 'bg-red-500/20 text-red-400',
            txHash,
            timestamp,
            height
          };
        }
        
        if (msgData?.transfer) {
          const amount = msgData.transfer.amount;
          const recipient = msgData.transfer.recipient;
          return {
            title: 'Transfer',
            description: `Sent ${fmt(parseInt(amount) / 1e6)} to ${recipient.slice(0, 10)}...`,
            icon: 'fas fa-paper-plane',
            color: 'bg-blue-500/20 text-blue-400',
            txHash,
            timestamp,
            height
          };
        }
        
        if (msgData?.mint) {
          const amount = msgData.mint.amount;
          return {
            title: 'Mint',
            description: `Minted ${fmt(parseInt(amount) / 1e6)} tokens`,
            icon: 'fas fa-plus-circle',
            color: 'bg-green-500/20 text-green-400',
            txHash,
            timestamp,
            height
          };
        }
      }
      
      if (type === '/cosmos.bank.v1beta1.MsgSend') {
        const amount = msg.amount?.[0];
        if (amount?.denom === 'upaxi') {
          const paxiAmount = parseInt(amount.amount) / 1e6;
          return {
            title: 'Add Liquidity',
            description: `Added ${fmt(paxiAmount)} PAXI to LP`,
            icon: 'fas fa-water',
            color: 'bg-cyan-500/20 text-cyan-400',
            txHash,
            timestamp,
            height
          };
        }
      }
      
      return null;
    }
    
    function formatTime(timestamp) {
      try {
        const date = new Date(timestamp);
        const diff = Date.now() - date;
        
        const m = Math.floor(diff / 60000);
        const h = Math.floor(diff / 3600000);
        const d = Math.floor(diff / 86400000);
        
        if (m < 1) return 'Now';
        if (m < 60) return `${m}m`;
        if (h < 24) return `${h}h`;
        if (d < 7) return `${d}d`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch (e) {
        return 'Unknown';
      }
    }
    
    function refreshActions() {
      const listEl = document.getElementById('actions-list');
      listEl.innerHTML = `
        <div class="text-center py-8">
          <i class="fas fa-spinner fa-spin text-2xl text-yellow-400 mb-2"></i>
          <p class="text-sm text-gray-500">Refreshing...</p>
        </div>
      `;
      fetchDevActions();
    }
    
    async function fetchMemeTokens() {
      const gridEl = document.getElementById('meme-grid');
      gridEl.innerHTML = '<div class="col-span-full text-center py-4"><i class="fas fa-spinner fa-spin text-2xl text-yellow-400"></i></div>';
      
      const tokens = [];
      
      for (const meme of MEME_TOKENS) {
        try {
          // --- TAMBAHKAN JEDA DI SINI ---
          await delay(500);
          
          // Get token info
          const infoData = await query(meme.address, { token_info: {} });
          
          if (infoData.data) {
            const info = infoData.data;
            
            // Get marketing info
            const marketingData = await query(meme.address, { marketing_info: {} });
            const marketing = marketingData.data || {};
            
            // Logika logo
            let logo = '';
            if (marketing.logo) {
              logo = marketing.logo.url || marketing.logo;
            } else if (info.logo) {
              logo = info.logo.url || info.logo;
            }
            
            // Get price from pool
            let price = null;
            let poolExists = false;
            try {
              const poolUrl = `${RPC}/paxi/swap/pool/${meme.address}`;
              const poolRes = await fetch(poolUrl, { signal: AbortSignal.timeout(5000) });
              if (poolRes.ok) {
                const pool = await poolRes.json();
                price = parseFloat(pool.price_paxi_per_prc20);
                poolExists = true;
              }
            } catch (e) {
              console.log(`No pool for ${meme.symbol}`);
            }
            
            tokens.push({
              address: meme.address,
              name: info.name || meme.symbol,
              symbol: info.symbol || meme.symbol,
              decimals: info.decimals || 6,
              totalSupply: info.total_supply,
              logo: logo,
              description: marketing.description || '',
              project: marketing.project || '',
              price: price,
              poolExists: poolExists
            });
          }
        } catch (e) {
          console.error(`Error fetching ${meme.symbol}:`, e);
        }
      }
      
      // Render logic tetap sama...
      if (tokens.length === 0) {
        gridEl.innerHTML = '<div class="col-span-full text-center py-4"><p class="text-sm text-gray-500">No meme tokens found</p></div>';
        return;
      }
      
      gridEl.innerHTML = tokens.map(token => {
        const escapedToken = JSON.stringify(token).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        return `
    <div class="glass-card rounded-lg p-3 text-center hover:scale-105 transition cursor-pointer" onclick='showTokenDetail(${escapedToken})'>
      <div class="w-12 h-12 mx-auto mb-2 rounded-full overflow-hidden border border-yellow-500/30">
        ${token.logo ? 
          `<img src="${token.logo}" class="w-full h-full object-cover" alt="${token.symbol}" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full bg-yellow-500/20 flex items-center justify-center\\'><i class=\\'fas fa-coins text-yellow-400\\'></i></div>'">` 
          : 
          `<div class="w-full h-full bg-yellow-500/20 flex items-center justify-center"><i class="fas fa-coins text-yellow-400"></i></div>`
        }
      </div>
      <p class="text-xs font-bold mb-1">${token.symbol}</p>
      ${token.price ? 
        `<p class="text-xs text-green-400">${token.price.toFixed(6)} PAXI</p>` 
        : 
        `<p class="text-xs text-gray-500">No pool</p>`
      }
    </div>
  `
      }).join('');
    }
    
    // Show token detail modal
    function showTokenDetail(token) {
      const modal = document.getElementById('token-modal');
      const content = document.getElementById('modal-content');
      
      const supply = token.totalSupply ? fmt(parseInt(token.totalSupply) / Math.pow(10, token.decimals)) : 'N/A';
      const priceUsd = token.price ? (token.price * CFG.paxiPrice).toFixed(8) : 'N/A';
      const mcap = token.price && token.totalSupply ? fmt((parseInt(token.totalSupply) / Math.pow(10, token.decimals)) * token.price) : 'N/A';
      
      content.innerHTML = `
        <div class="text-center mb-6">
          <div class="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-2 border-yellow-500/50">
            ${token.logo ? 
              `<img src="${token.logo}" class="w-full h-full object-cover" alt="${token.symbol}" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full bg-yellow-500/20 flex items-center justify-center\\'><i class=\\'fas fa-coins text-4xl text-yellow-400\\'></i></div>'">` 
              : 
              `<div class="w-full h-full bg-yellow-500/20 flex items-center justify-center"><i class="fas fa-coins text-4xl text-yellow-400"></i></div>`
            }
          </div>
          <h2 class="text-2xl font-bold royal-font gold-text mb-1">${token.name}</h2>
          <p class="text-lg text-yellow-400 font-bold mb-2">$${token.symbol}</p>
          ${token.description ? `<p class="text-sm text-gray-400 mb-2">${token.description}</p>` : ''}
        </div>
        
        <div class="space-y-3 mb-6">
          ${token.poolExists ? `
          <div class="glass-card rounded-lg p-4">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm text-gray-400">Price</span>
              <div class="text-right">
                <p class="text-sm font-bold text-yellow-400">${token.price.toFixed(6)} PAXI</p>
                <p class="text-xs text-gray-500">≈ $${priceUsd}</p>
              </div>
            </div>
          </div>
          
          <div class="glass-card rounded-lg p-4">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-400">Market Cap</span>
              <p class="text-sm font-bold text-green-400">${mcap} PAXI</p>
            </div>
          </div>
          ` : `
          <div class="glass-card rounded-lg p-4 bg-orange-500/10 border-orange-500/30">
            <div class="flex items-center gap-2">
              <i class="fas fa-exclamation-triangle text-orange-400"></i>
              <p class="text-sm text-orange-400">No liquidity pool found</p>
            </div>
          </div>
          `}
          
          <div class="glass-card rounded-lg p-4">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-400">Total Supply</span>
              <p class="text-sm font-bold">${supply} ${token.symbol}</p>
            </div>
          </div>
          
          <div class="glass-card rounded-lg p-4">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-400">Decimals</span>
              <p class="text-sm font-bold">${token.decimals}</p>
            </div>
          </div>
          
          ${token.project ? `
          <div class="glass-card rounded-lg p-4">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-400">Project</span>
              <a href="${token.project}" target="_blank" class="text-sm font-bold text-blue-400 hover:text-blue-300">
                Visit <i class="fas fa-external-link-alt ml-1 text-xs"></i>
              </a>
            </div>
          </div>
          ` : ''}
          
          <div class="glass-card rounded-lg p-4">
            <p class="text-xs text-gray-400 mb-2">Contract Address</p>
            <div class="flex items-center gap-2">
              <p class="text-xs font-mono text-yellow-400 break-all flex-1">${token.address}</p>
              <button onclick="copyAddress('${token.address}')" class="text-yellow-400 hover:text-yellow-300 flex-shrink-0">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>
        </div>
        
        <div class="flex gap-2">
          <a href="https://winscan.winsnip.xyz/paxi-mainnet/assets/${token.address}" target="_blank" 
             class="btn-gold flex-1 px-4 py-3 rounded-lg text-sm text-black font-semibold text-center">
            <i class="fas fa-external-link-alt mr-2"></i>View on Winscan
          </a>
          ${token.poolExists ? `
          <a href="https://winscan.winsnip.xyz/paxi-mainnet/prc20/swap?from=${token.address}" target="_blank" 
             class="btn-outline flex-1 px-4 py-3 rounded-lg text-sm text-yellow-400 font-semibold text-center">
            <i class="fas fa-exchange-alt mr-2"></i>Trade
          </a>
          ` : ''}
        </div>
      `;
      
      modal.classList.remove('hidden');
    }
    
    function closeModal(event) {
      if (!event || event.target.id === 'token-modal') {
        document.getElementById('token-modal').classList.add('hidden');
      }
    }
    
    function copyAddress(address) {
      navigator.clipboard.writeText(address).then(() => {
        // Show toast notification
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        toast.innerHTML = '<i class="fas fa-check mr-2"></i>Address copied!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
      });
    }
    
    async function init() {
      updateUI();
      fetchLogo();
      fetchPaxiPrice().then(() => {
        fetchTokenInfo();
        fetchMetrics();
      });
      fetchHolders();
      fetchDevActions();
      fetchMemeTokens();
    }
    
    document.addEventListener('DOMContentLoaded', init);