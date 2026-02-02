# TODO: Nested Routes Implementation

## Folder Structure to Create

```
app/
└── dashboard/
    ├── layout.tsx          ← Shared layout (sidebar + top nav) ✅ EXISTS
    ├── page.tsx            ← /dashboard ✅ EXISTS
    │
    ├── analytics/
    │   └── page.tsx        ← /dashboard/analytics
    │
    ├── assets/
    │   ├── layout.tsx      ← Optional: layout just for assets section
    │   ├── page.tsx        ← /dashboard/assets
    │   ├── list/
    │   │   └── page.tsx    ← /dashboard/assets/list
    │   └── tags/
    │       └── page.tsx    ← /dashboard/assets/tags
    │
    ├── reports/
    │   ├── page.tsx        ← /dashboard/reports
    │   └── [reportId]/
    │       └── page.tsx    ← /dashboard/reports/123 (dynamic route)
    │
    └── settings/
        ├── page.tsx        ← /dashboard/settings
        ├── profile/
        │   └── page.tsx    ← /dashboard/settings/profile
        └── security/
            └── page.tsx    ← /dashboard/settings/security
```

---

## How Nested Routes Work

1. **`layout.tsx`** wraps all children - sidebar/topnav stays persistent
2. **`page.tsx`** is the actual content for that route
3. **Nested folders** = nested URL segments

---

## Update Side Nav to be Dynamic

### Step 1: Create nav config in DashboardContent.tsx

```tsx
const getSideNavItems = () => {
  if (pathname.startsWith("/dashboard/assets")) {
    return [
      { href: "/dashboard/assets", icon: FiBox, label: "All Assets" },
      { href: "/dashboard/assets/list", icon: FiList, label: "List View" },
      { href: "/dashboard/assets/tags", icon: FiTag, label: "Tags" },
    ];
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return [
      { href: "/dashboard/settings", icon: FiSettings, label: "General" },
      { href: "/dashboard/settings/profile", icon: FiUser, label: "Profile" },
      { href: "/dashboard/settings/security", icon: FiShield, label: "Security" },
    ];
  }
  if (pathname.startsWith("/dashboard/reports")) {
    return [
      { href: "/dashboard/reports", icon: FiFileText, label: "All Reports" },
      { href: "/dashboard/reports/new", icon: FiPlus, label: "New Report" },
    ];
  }
  // Default dashboard nav
  return [
    { href: "/dashboard", icon: FiHome, label: "Home" },
    { href: "/dashboard/analytics", icon: FiBarChart2, label: "Analytics" },
    { href: "/dashboard/activity", icon: FiActivity, label: "Activity" },
  ];
};
```

### Step 2: Render dynamic nav items

```tsx
{getSideNavItems().map((item) => (
  <Link 
    key={item.href}
    href={item.href} 
    className={`p-3 rounded-full transition-all duration-200 ${
      pathname === item.href 
        ? "bg-brand-2" 
        : "hover:bg-brand-1"
    }`}
  >
    <item.icon className={`w-6 h-6 ${
      pathname === item.href 
        ? "text-white" 
        : "text-text-secondary"
    }`} />
  </Link>
))}
```

---

## Checking Active Routes

```tsx
const pathname = usePathname();

// Check if on any assets sub-route (includes all nested)
pathname.startsWith("/dashboard/assets")  // true for /dashboard/assets/list

// Check exact match
pathname === "/dashboard/assets"  // only true for exact path

// Check if active section for top nav highlighting
const isActiveSection = (section: string) => {
  if (section === "/dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/analytics");
  }
  return pathname.startsWith(section);
};
```

---

## Icons to Import

```tsx
import { 
  FiHome, 
  FiBox, 
  FiSettings, 
  FiLogOut, 
  FiBell,
  FiList,
  FiTag,
  FiUser,
  FiShield,
  FiFileText,
  FiPlus,
  FiBarChart2,
  FiActivity
} from "react-icons/fi";
```

---

## Files to Create

- [ ] `app/dashboard/analytics/page.tsx`
- [ ] `app/dashboard/assets/page.tsx`
- [ ] `app/dashboard/assets/list/page.tsx`
- [ ] `app/dashboard/assets/tags/page.tsx`
- [ ] `app/dashboard/reports/page.tsx`
- [ ] `app/dashboard/settings/page.tsx`
- [ ] `app/dashboard/settings/profile/page.tsx`
- [ ] `app/dashboard/settings/security/page.tsx`

---

## Notes

- Top nav changes URL sections (`/dashboard`, `/dashboard/assets`, etc.)
- Side nav changes sub-views within each section
- Side nav content is dynamic based on `pathname`
- Use `pathname.startsWith()` to determine current section
