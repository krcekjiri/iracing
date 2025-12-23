const { useState, useMemo, useRef, useEffect, useCallback } = React;

// Entry point - all code has been split into modules
// Load order is managed by index.html

// Initialize the app
const root = ReactDOM.createRoot(document.getElementById('app-root'));
root.render(<PlannerApp />);
