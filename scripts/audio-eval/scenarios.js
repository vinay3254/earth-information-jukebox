// Scenario runners for driving Space, Earth, and Frame Lab views

export async function ensureEntered(page) {
  const gateGo = page.locator('#gate-go');
  if (await gateGo.isVisible({ timeout: 1500 }).catch(() => false)) {
    await gateGo.click();
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const g = document.getElementById('gate');
      if (g) {
        g.hidden = true;
        g.style.display = 'none';
        g.style.pointerEvents = 'none';
      }
    });
  }
}

export const SCENARIOS = {
  // Comprehensive Space scenario
  space: async (page) => {
    await ensureEntered(page);
    await page.keyboard.press('KeyS');
    await page.waitForTimeout(600);

    // Set space orbit speed to Fast (4x) so orbit chimes ring frequently
    const speedSelect = page.locator('#space-speed');
    if (await speedSelect.count() > 0) {
      await speedSelect.selectOption('4').catch(() => {});
    }

    await page.evaluate(() => window.__evalHarness.start('space'));

    // 1. Click planet buttons to hear individual planet chimes
    const planets = ['mercury', 'earth', 'jupiter', 'saturn'];
    for (const pid of planets) {
      const btn = page.locator(`#planet-list button[data-id="${pid}"]`);
      if (await btn.count() > 0) {
        await btn.click({ force: true });
        await page.waitForTimeout(800);
      }
    }

    // 2. Enable orbit chimes
    const chimeBtn = page.locator('#chimes');
    await chimeBtn.click({ force: true });
    await page.waitForTimeout(3000);

    // 3. Pause orbit chimes and measure silence-after-pause
    await page.evaluate(() => window.__evalHarness.markPause());
    await chimeBtn.click({ force: true });
    await page.waitForTimeout(1200);

    return await page.evaluate(() => window.__evalHarness.stop());
  },

  // Space: planet clicks only
  'space-planets': async (page) => {
    await ensureEntered(page);
    await page.keyboard.press('KeyS');
    await page.waitForTimeout(600);

    await page.evaluate(() => window.__evalHarness.start('space-planets'));

    const planets = ['mercury', 'venus', 'earth', 'jupiter'];
    for (const pid of planets) {
      const btn = page.locator(`#planet-list button[data-id="${pid}"]`);
      if (await btn.count() > 0) {
        await btn.click({ force: true });
        await page.waitForTimeout(800);
      }
    }

    return await page.evaluate(() => window.__evalHarness.stop());
  },

  // Space: orbit chimes only
  'space-chimes': async (page) => {
    await ensureEntered(page);
    await page.keyboard.press('KeyS');
    await page.waitForTimeout(600);

    const speedSelect = page.locator('#space-speed');
    if (await speedSelect.count() > 0) {
      await speedSelect.selectOption('4').catch(() => {});
    }

    await page.evaluate(() => window.__evalHarness.start('space-chimes'));

    const chimeBtn = page.locator('#chimes');
    await chimeBtn.click({ force: true });
    await page.waitForTimeout(3000);

    await page.evaluate(() => window.__evalHarness.markPause());
    await chimeBtn.click({ force: true });
    await page.waitForTimeout(1500);

    return await page.evaluate(() => window.__evalHarness.stop());
  },

  // Comprehensive Earth scenario
  earth: async (page) => {
    await ensureEntered(page);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('KeyG');
    await page.locator('.view-tab[data-view="globe"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);

    await page.evaluate(() => window.__evalHarness.start('earth'));

    // 1. Select region
    await page.evaluate(() => {
      const btn = document.querySelector('.region-list button');
      if (btn) btn.click();
    });
    await page.waitForTimeout(800);

    // 2. Play this year
    await page.evaluate(() => {
      const btn = document.getElementById('synth-play');
      if (btn) btn.click();
    });
    await page.waitForTimeout(3000);

    // 3. Pause and measure silence-after-pause
    await page.evaluate(() => window.__evalHarness.markPause());
    await page.evaluate(() => {
      const btn = document.getElementById('synth-play');
      if (btn) btn.click();
    });
    await page.waitForTimeout(1200);

    // 4. Play all years sweep
    await page.evaluate(() => {
      const btn = document.getElementById('synth-sweep');
      if (btn) btn.click();
    });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const btn = document.getElementById('synth-play');
      if (btn && btn.getAttribute('aria-pressed') === 'true') btn.click();
    });
    await page.waitForTimeout(600);

    // 5. Compare mode
    await page.keyboard.press('KeyC');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const cmpGo = document.getElementById('cmp-go');
      if (cmpGo) cmpGo.click();
    });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const playBtn = document.getElementById('synth-play');
      if (playBtn && playBtn.getAttribute('aria-pressed') === 'true') playBtn.click();
    });
    await page.waitForTimeout(600);

    return await page.evaluate(() => window.__evalHarness.stop());
  },

  // Earth: Play single year
  'earth-play': async (page) => {
    await ensureEntered(page);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('KeyG');
    await page.locator('.view-tab[data-view="globe"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);

    await page.evaluate(() => window.__evalHarness.start('earth-play'));

    await page.evaluate(() => {
      const btn = document.querySelector('.region-list button');
      if (btn) btn.click();
    });
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      const btn = document.getElementById('synth-play');
      if (btn) btn.click();
    });
    await page.waitForTimeout(3000);

    await page.evaluate(() => window.__evalHarness.markPause());
    await page.evaluate(() => {
      const btn = document.getElementById('synth-play');
      if (btn) btn.click();
    });
    await page.waitForTimeout(1200);

    return await page.evaluate(() => window.__evalHarness.stop());
  },

  // Earth: Sweep
  'earth-sweep': async (page) => {
    await ensureEntered(page);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('KeyG');
    await page.locator('.view-tab[data-view="globe"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);

    await page.evaluate(() => window.__evalHarness.start('earth-sweep'));

    await page.evaluate(() => {
      const btn = document.querySelector('.region-list button');
      if (btn) btn.click();
    });
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      const btn = document.getElementById('synth-sweep');
      if (btn) btn.click();
    });
    await page.waitForTimeout(3000);

    await page.evaluate(() => window.__evalHarness.markPause());
    await page.evaluate(() => {
      const btn = document.getElementById('synth-play');
      if (btn) btn.click();
    });
    await page.waitForTimeout(1200);

    return await page.evaluate(() => window.__evalHarness.stop());
  },

  // Earth: Compare
  'earth-compare': async (page) => {
    await ensureEntered(page);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('KeyG');
    await page.locator('.view-tab[data-view="globe"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);

    await page.evaluate(() => window.__evalHarness.start('earth-compare'));

    await page.evaluate(() => {
      const btn = document.querySelector('.region-list button');
      if (btn) btn.click();
    });
    await page.waitForTimeout(800);

    await page.keyboard.press('KeyC');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const cmpGo = document.getElementById('cmp-go');
      if (cmpGo) cmpGo.click();
    });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.__evalHarness.markPause());
    await page.evaluate(() => {
      const playBtn = document.getElementById('synth-play');
      if (playBtn && playBtn.getAttribute('aria-pressed') === 'true') playBtn.click();
    });
    await page.waitForTimeout(1200);

    return await page.evaluate(() => window.__evalHarness.stop());
  },

  // Comprehensive Frame Lab scenario
  lab: async (page) => {
    await ensureEntered(page);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('KeyL');
    await page.locator('.view-tab[data-view="lab"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);

    // Select track 1 first
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(800);

    await page.evaluate(() => window.__evalHarness.start('lab'));

    // 1. Play track 1
    await page.evaluate(() => {
      const p = document.getElementById('lab-play');
      if (p) p.click();
    });
    await page.waitForTimeout(3000);

    // 2. Pause and measure silence
    await page.evaluate(() => window.__evalHarness.markPause());
    await page.evaluate(() => {
      const p = document.getElementById('lab-play');
      if (p) p.click();
    });
    await page.waitForTimeout(1200);

    // 3. Cycle tracks 2, 3, 4
    for (const key of ['Digit2', 'Digit3', 'Digit4']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(1500);
    }

    // 4. Explore by hand
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);

    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    for (const k of keys) {
      await page.keyboard.press(k);
      await page.waitForTimeout(400);
    }

    await page.keyboard.press('KeyE'); // Exit explore
    await page.waitForTimeout(600);

    return await page.evaluate(() => window.__evalHarness.stop());
  },

  // Lab: Track 1 play only
  'lab-play': async (page) => {
    await ensureEntered(page);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('KeyL');
    await page.locator('.view-tab[data-view="lab"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);

    await page.keyboard.press('Digit1');
    await page.waitForTimeout(800);

    await page.evaluate(() => window.__evalHarness.start('lab-play'));

    await page.evaluate(() => {
      const p = document.getElementById('lab-play');
      if (p) p.click();
    });
    await page.waitForTimeout(3000);

    await page.evaluate(() => window.__evalHarness.markPause());
    await page.evaluate(() => {
      const p = document.getElementById('lab-play');
      if (p) p.click();
    });
    await page.waitForTimeout(1200);

    return await page.evaluate(() => window.__evalHarness.stop());
  },

  // Lab: Cycle tracks
  'lab-tracks': async (page) => {
    await ensureEntered(page);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('KeyL');
    await page.locator('.view-tab[data-view="lab"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);

    await page.evaluate(() => window.__evalHarness.start('lab-tracks'));

    for (const key of ['Digit1', 'Digit2', 'Digit3', 'Digit4']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(1500);
    }

    return await page.evaluate(() => window.__evalHarness.stop());
  },

  // Lab: Explore
  'lab-explore': async (page) => {
    await ensureEntered(page);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('KeyL');
    await page.locator('.view-tab[data-view="lab"]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);

    await page.keyboard.press('Digit1');
    await page.waitForTimeout(800);

    await page.evaluate(() => window.__evalHarness.start('lab-explore'));

    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);

    const keys = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    for (const k of keys) {
      await page.keyboard.press(k);
      await page.waitForTimeout(500);
    }

    await page.keyboard.press('KeyE');
    await page.waitForTimeout(600);

    return await page.evaluate(() => window.__evalHarness.stop());
  }
};
