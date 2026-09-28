// Sample houses for index.html?demo: click around without touching the real Sheet.
// Nothing here is loaded on the live site unless ?demo is in the address.

const STREET_POINTS = {   // rough midpoints, used to place new mock RSVPs
  'Birch Street': [36.1500, -115.1692], 'Bonnie Brae Avenue': [36.1507, -115.1708],
  'Bryn Mawr Avenue': [36.1497, -115.1724], 'Glen Heather Way': [36.1477, -115.1700],
  'Inverness Avenue': [36.1488, -115.1703], 'Ivanhoe Way': [36.1494, -115.1682],
  'Kiltie Way': [36.1507, -115.1673], 'Kirkland Avenue': [36.1497, -115.1700],
  'Loch Lomond Way': [36.1496, -115.1675]
};


const households = [
  { num: '1804', street: 'Kiltie Way', candy: true, decorated: true, special: false, kids: 2, lat: 36.15138, lng: -115.16731 },
  { num: '1812', street: 'Kiltie Way', candy: true, decorated: false, special: false, kids: 0, lat: 36.15044, lng: -115.16732 },
  { num: '1900', street: 'Loch Lomond Way', candy: true, decorated: true, special: true, note: 'Haunted garage 5–6 PM 👻', name: 'The Parks', kids: 3, lat: 36.14904, lng: -115.16795 },
  { num: '1921', street: 'Loch Lomond Way', candy: true, kids: 0, lat: 36.14835, lng: -115.16856 },
  { num: '1710', street: 'Ivanhoe Way', candy: true, decorated: true, kids: 1, lat: 36.14932, lng: -115.16827 },
  { num: '2001', street: 'Birch Street', candy: true, kids: 2, lat: 36.15100, lng: -115.16920 },
  { num: '2017', street: 'Birch Street', candy: true, decorated: true, name: 'The Garcias', kids: 0, lat: 36.15043, lng: -115.16926 },
  { num: '2112', street: 'Kirkland Avenue', candy: true, special: true, note: 'Raffle tickets sold here 🎟️', name: "Shelly's", kids: 0, lat: 36.14928, lng: -115.17137 },
  { num: '2124', street: 'Kirkland Avenue', candy: true, kids: 2, lat: 36.14880, lng: -115.17176 },
  { num: '1601', street: 'Bryn Mawr Avenue', candy: true, decorated: true, kids: 0, lat: 36.15104, lng: -115.17237 },
  { num: '1633', street: 'Bryn Mawr Avenue', candy: true, special: true, note: 'Drinks for the grown-ups 🍷', kids: 2, lat: 36.14892, lng: -115.17241 },
  { num: '2205', street: 'Bonnie Brae Avenue', candy: true, kids: 1, lat: 36.15071, lng: -115.17080 },
  { num: '2231', street: 'Bonnie Brae Avenue', decorated: true, kids: 0, lat: 36.15073, lng: -115.17190 },
  { num: '1809', street: 'Inverness Avenue', candy: true, decorated: true, kids: 4, lat: 36.14930, lng: -115.17030 },
  { num: '1825', street: 'Inverness Avenue', candy: true, kids: 0, lat: 36.14836, lng: -115.17024 },
  // Kids-only households (not on the map, but counted)
  { num: '1820', street: 'Kiltie Way', kids: 3 }, { num: '2009', street: 'Birch Street', kids: 2 },
  { num: '1605', street: 'Bryn Mawr Avenue', kids: 4 }, { num: '1817', street: 'Inverness Avenue', kids: 2 },
  { num: '2215', street: 'Bonnie Brae Avenue', kids: 3 }, { num: '1915', street: 'Loch Lomond Way', kids: 2 },
  { num: '2130', street: 'Kirkland Avenue', kids: 5 }, { num: '1705', street: 'Glen Heather Way', kids: 2 }, { num: '1722', street: 'Ivanhoe Way', kids: 2 }
];

const wait = ms => new Promise(r => setTimeout(r, ms));
const jitter = ([a, b]) => [a + (Math.random() - .5) * .0008, b + (Math.random() - .5) * .0008];
const sameHouse = (a, b) => a.num === b.num && a.street === b.street;
const isStop = h => h.candy || h.decorated || h.special;

// Same shapes the Apps Script backend returns.
export const demoApi = {
  async load() {
    await wait(250);
    const houses = households.filter(isStop).map(({ kids, ...pub }) => ({ ...pub }));
    const kids = households.reduce((n, h) => n + (h.kids || 0), 0);
    return { ok: true, houses, totals: { houses: houses.length, kids } };
  },
  async rsvp(entry) {
    await wait(700);
    const i = households.findIndex(h => sameHouse(h, entry));
    const prev = i >= 0 ? households[i] : null;
    if (!isStop(entry) && !entry.kids) {
      if (prev) households.splice(i, 1);
      return { ok: true, removed: !!prev };
    }
    const [lat, lng] = prev && prev.lat ? [prev.lat, prev.lng] : jitter(STREET_POINTS[entry.street]);
    const row = { ...entry, lat, lng };
    if (prev) households[i] = row; else households.push(row);
    return { ok: true, updated: !!prev };
  }
};
