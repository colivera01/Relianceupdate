# Environment Configuration Guide

## Development Scripts

### Live Mode (Next.js API Routes)
```bash
npm run dev:live
# or
npm run dev
```
- Uses Next.js API routes at `/api/*`
- No MSW interception
- API calls go directly to Next.js backend

### Mock Mode (MSW + Mock Data)
```bash
npm run dev:mock
```
- Starts MSW worker for API interception
- Uses mock data from `src/mocks/fixtures/`
- All `/api/*` calls are intercepted by MSW

## Environment Variables

### For Live Mode
```bash
# .env.local
NEXT_PUBLIC_API_MODE=live
# NEXT_PUBLIC_API_BASE_URL is not needed (uses relative paths)
```

### For Mock Mode
```bash
# .env.local
NEXT_PUBLIC_API_MODE=mock
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

## How It Works

1. **Live Mode**: API calls use relative paths (`/api/users`) and go to Next.js API routes
2. **Mock Mode**: MSW intercepts all `/api/*` calls and returns mock data
3. **Repository Pattern**: Automatically switches between HTTP and Mock implementations based on `NEXT_PUBLIC_API_MODE`

## Testing

- **Live Mode**: Visit `/test-msw` to see "Live Mode" badge
- **Mock Mode**: Visit `/test-msw` to see "Mock Mode" badge and test CRUD operations


