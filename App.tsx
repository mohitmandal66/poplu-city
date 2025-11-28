

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, TileData, BuildingType, CityStats, NewsItem } from './types';
import { GRID_SIZE, BUILDINGS, TICK_RATE_MS, INITIAL_MONEY, LAND_COST, LAND_SELL } from './constants';
import IsoMap from './components/IsoMap';
import UIOverlay from './components/UIOverlay';
import StartScreen from './components/StartScreen';
import { generateNewsEvent } from './services/geminiService';

// Initialize grid with ownership, river, and rail
const createInitialGrid = (): Grid => {
  const grid: Grid = [];
  const center = Math.floor(GRID_SIZE / 2);
  const ownedRadius = 2; // Central 5x5 area is owned

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: TileData[] = [];
    
    // River generation (runs West-East with sine wave)
    const riverY = Math.floor(center + Math.sin(y * 0.4) * 2.5);

    for (let x = 0; x < GRID_SIZE; x++) {
      let isOwned = Math.abs(x - center) <= ownedRadius && Math.abs(y - center) <= ownedRadius;
      const isRiver = Math.abs(x - riverY) < 1.5; // Width of river
      
      const dist = Math.sqrt(Math.pow(x-center, 2) + Math.pow(y-center, 2));
      const basePrice = 5000;
      const randomVariance = Math.floor(Math.random() * 5000);
      const plotPrice = basePrice + randomVariance + Math.floor(dist * 500);

      row.push({ 
        x, 
        y, 
        buildingType: BuildingType.None, 
        owned: isOwned,
        isWater: isRiver,
        isRail: false, // Rail must be built now
        landPrice: plotPrice
      });
    }
    grid.push(row);
  }
  return grid;
};

function App() {
  // --- Game State ---
  const [gameStarted, setGameStarted] = useState(false);

  const [grid, setGrid] = useState<Grid>(createInitialGrid);
  const [stats, setStats] = useState<CityStats>({ money: INITIAL_MONEY, population: 0, day: 1 });
  const [selectedTool, setSelectedTool] = useState<BuildingType>(BuildingType.Road);
  const [timeOfDay, setTimeOfDay] = useState(0); // 0 to 1 cycle
  
  // --- AI State ---
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>([]);
  
  // Refs for accessing state inside intervals without dependencies
  const gridRef = useRef(grid);
  const statsRef = useRef(stats);
  const tickCounter = useRef(0);

  // Sync refs
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  // --- AI Logic Wrappers ---

  const addNewsItem = useCallback((item: NewsItem) => {
    setNewsFeed(prev => [...prev.slice(-12), item]); // Keep last few
  }, []);

  const fetchNews = useCallback(async () => {
    // chance to fetch news per tick
    if (Math.random() > 0.15) return; 
    const news = await generateNewsEvent(statsRef.current, null);
    if (news) addNewsItem(news);
  }, [addNewsItem]);


  // --- Initial Setup ---
  useEffect(() => {
    if (!gameStarted) return;

    addNewsItem({ id: Date.now().toString(), text: "Welcome to POPLU CITY. Terrain generation complete.", type: 'positive' });
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted]);


  // --- Game Loop ---
  useEffect(() => {
    if (!gameStarted) return;

    // Day/Night Cycle (Smoother update than tick)
    // Slower and smoother: +0.001 every 200ms
    const dayInterval = setInterval(() => {
        setTimeOfDay(prev => (prev + 0.001) % 1);
    }, 200);

    const intervalId = setInterval(() => {
      tickCounter.current += 1;
      // Increment day only every 10 ticks (approx 20 seconds) to slow down day passing
      const isNewDay = tickCounter.current % 10 === 0;

      // 1. Calculate income/pop gen
      let dailyIncome = 0;
      let dailyPopGrowth = 0;
      let buildingCounts: Record<string, number> = {};

      gridRef.current.flat().forEach(tile => {
        if (tile.buildingType !== BuildingType.None && tile.owned) {
          const config = BUILDINGS[tile.buildingType];
          if (config) { // Check if config exists
             if (config.type !== BuildingType.Land) {
                 dailyIncome += config.incomeGen;
                 dailyPopGrowth += config.popGen;
                 buildingCounts[tile.buildingType] = (buildingCounts[tile.buildingType] || 0) + 1;
             }
          }
        }
      });

      // Cap population growth by residential count just for some logic
      const resCount = buildingCounts[BuildingType.Residential] || 0;
      const maxPop = resCount * 50; // 50 people per house max

      // 2. Update Stats
      setStats(prev => {
        let newPop = prev.population + dailyPopGrowth;
        if (newPop > maxPop) newPop = maxPop; // limit
        if (resCount === 0 && prev.population > 0) newPop = Math.max(0, prev.population - 5); // people leave if no homes

        const newStats = {
          money: prev.money + dailyIncome,
          population: newPop,
          day: isNewDay ? prev.day + 1 : prev.day,
        };
        
        return newStats;
      });

      // 4. Trigger news
      fetchNews();

    }, TICK_RATE_MS);

    return () => {
        clearInterval(intervalId);
        clearInterval(dayInterval);
    };
  }, [fetchNews, gameStarted]);


  // --- Interaction Logic ---

  const handleTileClick = useCallback((x: number, y: number) => {
    if (!gameStarted) return; 

    const currentGrid = gridRef.current;
    const currentStats = statsRef.current;
    const tool = selectedTool; 
    
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;

    const currentTile = currentGrid[y][x];

    // --- LAND TOOL LOGIC ---
    if (tool === BuildingType.Land) {
        if (currentTile.isWater) {
             addNewsItem({id: Date.now().toString(), text: "Cannot purchase protected public waterways.", type: 'neutral'});
             return;
        }

        if (currentTile.owned) {
            // SELL LOGIC
            // Can only sell if empty
            if (currentTile.buildingType === BuildingType.None) {
                const sellPrice = Math.floor((currentTile.landPrice || LAND_COST) * 0.5);
                const newGrid = currentGrid.map(row => [...row]);
                newGrid[y][x] = { ...currentTile, owned: false };
                setGrid(newGrid);
                setStats(prev => ({ ...prev, money: prev.money + sellPrice }));
                addNewsItem({id: Date.now().toString(), text: `Land sold for $${sellPrice}.`, type: 'neutral'});
            } else {
                addNewsItem({id: Date.now().toString(), text: "Must clear building before selling land.", type: 'negative'});
            }
        } else {
            // BUY LOGIC
            const cost = currentTile.landPrice || LAND_COST;
            
            // Must be adjacent to owned land
            const hasOwnedNeighbor = 
                (x > 0 && currentGrid[y][x-1].owned) ||
                (x < GRID_SIZE - 1 && currentGrid[y][x+1].owned) ||
                (y > 0 && currentGrid[y-1][x].owned) ||
                (y < GRID_SIZE - 1 && currentGrid[y+1][x].owned);
            
            if (hasOwnedNeighbor) {
                if (currentStats.money >= cost) {
                    const newGrid = currentGrid.map(row => [...row]);
                    newGrid[y][x] = { ...currentTile, owned: true };
                    setGrid(newGrid);
                    setStats(prev => ({ ...prev, money: prev.money - cost }));
                    addNewsItem({id: Date.now().toString(), text: `New territory acquired for $${cost}.`, type: 'positive'});
                } else {
                    addNewsItem({id: Date.now().toString(), text: `Insufficient funds. Plot costs $${cost}.`, type: 'negative'});
                }
            } else {
                addNewsItem({id: Date.now().toString(), text: "Can only buy land adjacent to owned territory.", type: 'neutral'});
            }
        }
        return;
    }

    // --- STANDARD BUILDING TOOLS ---
    
    // Check ownership first
    if (!currentTile.owned) {
        addNewsItem({id: Date.now().toString(), text: "You do not own this land.", type: 'negative'});
        return;
    }

    // Check terrain obstacles
    if (currentTile.isWater) {
        // Bridges can be built on water
        if (tool !== BuildingType.Rail && tool !== BuildingType.Bridge) {
             addNewsItem({id: Date.now().toString(), text: "Cannot build on water. Build a bridge!", type: 'negative'});
             return;
        }
    } else {
        // Cannot build bridges on land (optional restriction, but keeps it clean)
        if (tool === BuildingType.Bridge) {
             addNewsItem({id: Date.now().toString(), text: "Bridges must be built on water.", type: 'negative'});
             return;
        }
    }

    const buildingConfig = BUILDINGS[tool];

    // Bulldoze logic
    if (tool === BuildingType.None) {
      if (currentTile.buildingType !== BuildingType.None) {
        const demolishCost = 5;
        if (currentStats.money >= demolishCost) {
            const newGrid = currentGrid.map(row => [...row]);
            newGrid[y][x] = { ...currentTile, buildingType: BuildingType.None, isRail: false }; // Clear rail too
            setGrid(newGrid);
            setStats(prev => ({ ...prev, money: prev.money - demolishCost }));
        } else {
            addNewsItem({id: Date.now().toString(), text: "Cannot afford demolition costs.", type: 'negative'});
        }
      }
      return;
    }

    // Placement Logic
    if (currentTile.buildingType === BuildingType.None || (tool === BuildingType.Rail && currentTile.isWater) || (tool === BuildingType.Bridge && currentTile.isWater)) {
      if (currentStats.money >= buildingConfig.cost) {
        // Deduct cost
        setStats(prev => ({ ...prev, money: prev.money - buildingConfig.cost }));
        
        // Place building
        const newGrid = currentGrid.map(row => [...row]);
        // Special case for Rail
        if (tool === BuildingType.Rail) {
            newGrid[y][x] = { ...currentTile, buildingType: BuildingType.Rail, isRail: true };
        } else {
            newGrid[y][x] = { ...currentTile, buildingType: tool };
        }
        setGrid(newGrid);
      } else {
        // Not enough money feedback
        addNewsItem({id: Date.now().toString() + Math.random(), text: `Treasury insufficient for ${buildingConfig.name}.`, type: 'negative'});
      }
    }
  }, [selectedTool, addNewsItem, gameStarted]);

  const handleStart = () => {
    setGameStarted(true);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden selection:bg-transparent selection:text-transparent bg-sky-900">
      {/* 3D Rendering Layer - Always visible now, providing background for start screen */}
      <IsoMap 
        grid={grid} 
        onTileClick={handleTileClick} 
        hoveredTool={selectedTool}
        population={stats.population}
        timeOfDay={timeOfDay}
      />
      
      {/* Start Screen Overlay */}
      {!gameStarted && (
        <StartScreen onStart={handleStart} />
      )}

      {/* UI Layer */}
      {gameStarted && (
        <UIOverlay
          stats={stats}
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
          newsFeed={newsFeed}
        />
      )}

      {/* CSS for animations and utility */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fade-in { animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .mask-image-b { -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%); mask-image: linear-gradient(to bottom, transparent 0%, black 15%); }
        
        /* Vertical text for toolbar label */
        .writing-mode-vertical { writing-mode: vertical-rl; text-orientation: mixed; }
        
        /* Custom scrollbar for news */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}</style>
    </div>
  );
}

export default App;