// Event details the site starts from. The admin page (/admin) saves its own copy to the backend,
// and once it has, the site and flyer use that instead. The admin page also starts from these.
window.GHW_DEFAULTS = {
  eventDate: '2026-10-31',
  hours: [
    { when: '4 – 6 PM', what: 'Glen Heather residents' },
    { when: 'After 6 PM', what: 'Regular Halloween' }
  ],
  raffle: {
    enabled: true,
    intro: 'Winner gets half of the pot. The neighborhood association keeps the other half.',
    location: "Shelly's house, 2112 Kirkland Ave",
    price: '$1 each · 6 for $5 · 12 for $10',
    pay: 'Cash or Zelle',
    drawing: 'After 9 PM on Halloween'
  }
};
