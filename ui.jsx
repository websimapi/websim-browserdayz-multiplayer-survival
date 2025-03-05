import { jsxDEV } from "react/jsx-dev-runtime";
const { useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;
const GameUI = () => {
  const [playerStats, setPlayerStats] = useState({
    health: 100,
    hunger: 100,
    thirst: 100,
    stamina: 100
  });
  const [inventory, setInventory] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [players, setPlayers] = useState({});
  const [isPaused, setIsPaused] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const [timeInfo, setTimeInfo] = useState({ time: "12:00 PM", isNight: false });
  const [compassInfo, setCompassInfo] = useState({ direction: "N", degrees: 0 });
  const [showCrafting, setShowCrafting] = useState(false);
  const chatInputRef = useRef(null);
  const chatMessagesRef = useRef(null);
  useEffect(() => {
    const statsUpdateInterval = setInterval(() => {
      if (window.game) {
        setPlayerStats({
          health: window.game.player.health,
          hunger: window.game.player.hunger,
          thirst: window.game.player.thirst,
          stamina: window.game.player.stamina
        });
      }
    }, 100);
    const handleInventoryUpdate = (event) => {
      setInventory(event.detail.inventory);
    };
    const handleChatUpdate = (event) => {
      setChatMessages(event.detail.messages);
      if (chatMessagesRef.current) {
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
      }
    };
    const handlePlayerListUpdate = (event) => {
      setPlayers(event.detail.players);
    };
    const handleGameStateChange = (event) => {
      setIsPaused(event.detail.isPaused);
    };
    const handlePlayerDeath = () => {
      setIsDead(true);
    };
    const handlePlayerRespawn = () => {
      setIsDead(false);
    };
    const handleTimeUpdate = (event) => {
      setTimeInfo({
        time: event.detail.time,
        isNight: event.detail.isNight
      });
    };
    const handleCompassUpdate = (event) => {
      setCompassInfo({
        direction: event.detail.direction,
        degrees: event.detail.degrees
      });
    };
    window.addEventListener("inventoryUpdated", handleInventoryUpdate);
    window.addEventListener("chatUpdated", handleChatUpdate);
    window.addEventListener("playerListUpdated", handlePlayerListUpdate);
    window.addEventListener("gameStateChanged", handleGameStateChange);
    window.addEventListener("playerDied", handlePlayerDeath);
    window.addEventListener("playerRespawned", handlePlayerRespawn);
    window.addEventListener("timeUpdated", handleTimeUpdate);
    window.addEventListener("compassUpdated", handleCompassUpdate);
    return () => {
      clearInterval(statsUpdateInterval);
      window.removeEventListener("inventoryUpdated", handleInventoryUpdate);
      window.removeEventListener("chatUpdated", handleChatUpdate);
      window.removeEventListener("playerListUpdated", handlePlayerListUpdate);
      window.removeEventListener("gameStateChanged", handleGameStateChange);
      window.removeEventListener("playerDied", handlePlayerDeath);
      window.removeEventListener("playerRespawned", handlePlayerRespawn);
      window.removeEventListener("timeUpdated", handleTimeUpdate);
      window.removeEventListener("compassUpdated", handleCompassUpdate);
    };
  }, []);
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);
  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (chatInputRef.current && chatInputRef.current.value.trim()) {
      if (window.game) {
        window.game.sendChatMessage(chatInputRef.current.value);
      }
      chatInputRef.current.value = "";
    }
  };
  const handleUseItem = (item, index) => {
    if (!window.game) return;
    switch (item.type) {
      case "food":
        window.game.player.hunger = Math.min(100, window.game.player.hunger + 30);
        break;
      case "water":
        window.game.player.thirst = Math.min(100, window.game.player.thirst + 40);
        break;
      case "medicine":
        window.game.player.health = Math.min(100, window.game.player.health + 25);
        break;
      case "weapon":
        window.game.player.equippedItem = item;
        return;
      // Don't consume weapons
      default:
        return;
    }
    const newInventory = [...inventory];
    if (newInventory[index].quantity > 1) {
      newInventory[index].quantity--;
    } else {
      newInventory.splice(index, 1);
    }
    window.game.player.inventory = newInventory;
    window.game.updateInventoryUI();
  };
  const handleRespawn = () => {
    if (window.game) {
      window.game.respawnPlayer();
    }
  };
  const handleResume = () => {
    if (window.game) {
      window.game.togglePauseMenu();
    }
  };
  const craftableItems = [
    {
      name: "Campfire",
      requirements: "Wood x3, Stone x2",
      canCraft: true
    },
    {
      name: "Improvised Backpack",
      requirements: "Cloth x4, Rope x1",
      canCraft: false
    },
    {
      name: "Water Purifier",
      requirements: "Bottle x1, Charcoal x2",
      canCraft: true
    },
    {
      name: "Improvised Bandage",
      requirements: "Cloth x2",
      canCraft: true
    },
    {
      name: "Makeshift Spear",
      requirements: "Wood x1, Stone x1, Rope x1",
      canCraft: true
    }
  ];
  const handleCraft = (item) => {
    console.log(`Crafting ${item.name}`);
    if (window.game) {
      window.game.addItemToInventory({
        type: "tool",
        quantity: 1,
        name: item.name
      });
    }
    setShowCrafting(false);
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "game-ui", children: [
    /* @__PURE__ */ jsxDEV("div", { className: "status-container", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "status-bar", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "status-fill health-fill", style: { width: `${playerStats.health}%` } }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 226,
          columnNumber: 21
        }),
        /* @__PURE__ */ jsxDEV("span", { className: "status-label", children: [
          "Health: ",
          Math.round(playerStats.health),
          "%"
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 227,
          columnNumber: 21
        })
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 225,
        columnNumber: 17
      }),
      /* @__PURE__ */ jsxDEV("div", { className: "status-bar", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "status-fill hunger-fill", style: { width: `${playerStats.hunger}%` } }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 230,
          columnNumber: 21
        }),
        /* @__PURE__ */ jsxDEV("span", { className: "status-label", children: [
          "Hunger: ",
          Math.round(playerStats.hunger),
          "%"
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 231,
          columnNumber: 21
        })
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 229,
        columnNumber: 17
      }),
      /* @__PURE__ */ jsxDEV("div", { className: "status-bar", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "status-fill thirst-fill", style: { width: `${playerStats.thirst}%` } }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 234,
          columnNumber: 21
        }),
        /* @__PURE__ */ jsxDEV("span", { className: "status-label", children: [
          "Thirst: ",
          Math.round(playerStats.thirst),
          "%"
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 235,
          columnNumber: 21
        })
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 233,
        columnNumber: 17
      }),
      /* @__PURE__ */ jsxDEV("div", { className: "status-bar", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "status-fill stamina-fill", style: { width: `${playerStats.stamina}%` } }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 238,
          columnNumber: 21
        }),
        /* @__PURE__ */ jsxDEV("span", { className: "status-label", children: [
          "Stamina: ",
          Math.round(playerStats.stamina),
          "%"
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 239,
          columnNumber: 21
        })
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 237,
        columnNumber: 17
      })
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 224,
      columnNumber: 13
    }),
    /* @__PURE__ */ jsxDEV("div", { className: "inventory-container", id: "inventory-container", style: { display: "none" }, children: [
      /* @__PURE__ */ jsxDEV("h3", { children: "Inventory" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 245,
        columnNumber: 17
      }),
      /* @__PURE__ */ jsxDEV("div", { className: "inventory-grid", children: [
        inventory.map((item, index) => /* @__PURE__ */ jsxDEV(
          "div",
          {
            className: "inventory-slot",
            onClick: () => handleUseItem(item, index),
            title: `${item.name} - ${item.type}`,
            children: [
              /* @__PURE__ */ jsxDEV("div", { className: "inventory-item", children: item.name.substring(0, 1) }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 254,
                columnNumber: 29
              }),
              item.quantity > 1 && /* @__PURE__ */ jsxDEV("span", { className: "inventory-item-count", children: item.quantity }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 258,
                columnNumber: 33
              })
            ]
          },
          index,
          true,
          {
            fileName: "<stdin>",
            lineNumber: 248,
            columnNumber: 25
          }
        )),
        Array(20 - inventory.length).fill().map((_, i) => /* @__PURE__ */ jsxDEV("div", { className: "inventory-slot" }, `empty-${i}`, false, {
          fileName: "<stdin>",
          lineNumber: 264,
          columnNumber: 25
        }))
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 246,
        columnNumber: 17
      })
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 244,
      columnNumber: 13
    }),
    /* @__PURE__ */ jsxDEV("div", { className: "chat-container", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "chat-messages", ref: chatMessagesRef, children: chatMessages.map((msg, index) => /* @__PURE__ */ jsxDEV(
        "div",
        {
          className: `chat-message ${msg.isSystem ? "system-message" : ""}`,
          style: { color: msg.isSystem ? "#ffff00" : "#ffffff" },
          children: [
            /* @__PURE__ */ jsxDEV("span", { className: "chat-timestamp", children: [
              "[",
              msg.timestamp,
              "] "
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 278,
              columnNumber: 29
            }),
            /* @__PURE__ */ jsxDEV("span", { className: "chat-username", children: [
              msg.username,
              ": "
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 279,
              columnNumber: 29
            }),
            /* @__PURE__ */ jsxDEV("span", { className: "chat-text", children: msg.message }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 280,
              columnNumber: 29
            })
          ]
        },
        index,
        true,
        {
          fileName: "<stdin>",
          lineNumber: 273,
          columnNumber: 25
        }
      )) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 271,
        columnNumber: 17
      }),
      /* @__PURE__ */ jsxDEV("form", { onSubmit: handleSendChatMessage, children: /* @__PURE__ */ jsxDEV(
        "input",
        {
          type: "text",
          className: "chat-input",
          id: "chat-input",
          placeholder: "Press Enter to chat...",
          ref: chatInputRef
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 285,
          columnNumber: 21
        }
      ) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 284,
        columnNumber: 17
      })
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 270,
      columnNumber: 13
    }),
    /* @__PURE__ */ jsxDEV("div", { className: "player-list", children: [
      /* @__PURE__ */ jsxDEV("h3", { children: [
        "Players Online (",
        Object.keys(players).length,
        ")"
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 297,
        columnNumber: 17
      }),
      Object.entries(players).map(([id, player]) => /* @__PURE__ */ jsxDEV(
        "div",
        {
          className: "player-entry",
          style: { color: player.isLocal ? "#00ff00" : "#ffffff" },
          children: [
            /* @__PURE__ */ jsxDEV(
              "img",
              {
                className: "player-avatar",
                src: `https://images.websim.ai/avatar/${player.username}`,
                alt: player.username
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 304,
                columnNumber: 25
              }
            ),
            /* @__PURE__ */ jsxDEV("span", { className: "player-username", children: player.username }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 309,
              columnNumber: 25
            })
          ]
        },
        id,
        true,
        {
          fileName: "<stdin>",
          lineNumber: 299,
          columnNumber: 21
        }
      ))
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 296,
      columnNumber: 13
    }),
    /* @__PURE__ */ jsxDEV("div", { className: "time-indicator", children: [
      /* @__PURE__ */ jsxDEV("span", { children: timeInfo.isNight ? "\u{1F319}" : "\u2600\uFE0F" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 316,
        columnNumber: 17
      }),
      /* @__PURE__ */ jsxDEV("span", { children: timeInfo.time }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 317,
        columnNumber: 17
      })
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 315,
      columnNumber: 13
    }),
    /* @__PURE__ */ jsxDEV("div", { className: "compass", children: /* @__PURE__ */ jsxDEV(
      "div",
      {
        className: "compass-direction",
        style: { transform: `translateX(-50%)` },
        children: compassInfo.direction
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 321,
        columnNumber: 17
      }
    ) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 320,
      columnNumber: 13
    }),
    showCrafting && /* @__PURE__ */ jsxDEV("div", { className: "crafting-container", id: "crafting-container", children: [
      /* @__PURE__ */ jsxDEV("h3", { className: "crafting-title", children: "Crafting" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 332,
        columnNumber: 21
      }),
      /* @__PURE__ */ jsxDEV("button", { className: "close-button", onClick: () => setShowCrafting(false), children: "\xD7" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 333,
        columnNumber: 21
      }),
      /* @__PURE__ */ jsxDEV("div", { className: "crafting-list", children: craftableItems.map((item, index) => /* @__PURE__ */ jsxDEV("div", { className: "crafting-item", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "crafting-item-info", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "crafting-item-name", children: item.name }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 338,
            columnNumber: 37
          }),
          /* @__PURE__ */ jsxDEV("div", { className: "crafting-item-requirements", children: item.requirements }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 339,
            columnNumber: 37
          })
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 337,
          columnNumber: 33
        }),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: "craft-button",
            disabled: !item.canCraft,
            onClick: () => handleCraft(item),
            children: "Craft"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 341,
            columnNumber: 33
          }
        )
      ] }, index, true, {
        fileName: "<stdin>",
        lineNumber: 336,
        columnNumber: 29
      })) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 334,
        columnNumber: 21
      })
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 331,
      columnNumber: 17
    }),
    isPaused && !isDead && /* @__PURE__ */ jsxDEV("div", { className: "menu-overlay", children: /* @__PURE__ */ jsxDEV("div", { className: "menu-container", children: [
      /* @__PURE__ */ jsxDEV("h2", { className: "menu-title", children: "Game Paused" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 358,
        columnNumber: 25
      }),
      /* @__PURE__ */ jsxDEV("button", { className: "menu-button", onClick: handleResume, children: "Resume Game" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 359,
        columnNumber: 25
      }),
      /* @__PURE__ */ jsxDEV("button", { className: "menu-button", onClick: () => setShowCrafting(true), children: "Crafting" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 360,
        columnNumber: 25
      }),
      /* @__PURE__ */ jsxDEV("button", { className: "menu-button", children: "Settings" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 361,
        columnNumber: 25
      }),
      /* @__PURE__ */ jsxDEV("button", { className: "menu-button danger", children: "Exit Game" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 362,
        columnNumber: 25
      })
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 357,
      columnNumber: 21
    }) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 356,
      columnNumber: 17
    }),
    isDead && /* @__PURE__ */ jsxDEV("div", { className: "menu-overlay", children: /* @__PURE__ */ jsxDEV("div", { className: "menu-container", children: [
      /* @__PURE__ */ jsxDEV("h2", { className: "menu-title", children: "You Have Died" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 371,
        columnNumber: 25
      }),
      /* @__PURE__ */ jsxDEV("p", { style: { color: "white", textAlign: "center", marginBottom: "20px" }, children: "The harsh world of BrowserDayZ has claimed another survivor..." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 372,
        columnNumber: 25
      }),
      /* @__PURE__ */ jsxDEV("button", { className: "menu-button", onClick: handleRespawn, children: "Respawn" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 375,
        columnNumber: 25
      })
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 370,
      columnNumber: 21
    }) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 369,
      columnNumber: 17
    })
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 222,
    columnNumber: 9
  });
};
const root = createRoot(document.getElementById("ui-overlay"));
root.render(/* @__PURE__ */ jsxDEV(GameUI, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 385,
  columnNumber: 13
}));
