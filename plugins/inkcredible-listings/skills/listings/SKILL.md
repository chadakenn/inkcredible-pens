---
name: inkcredible-listings
description: Draft, review, publish, update, and remove Inkcredible Pens storefront listings through the private MCP server.
---

# Inkcredible Listings

Use the Inkcredible Listings MCP tools for storefront catalog work.

## Required workflow

1. Start with `search_listings` when the user may be referring to an existing product.
2. For a new product, inspect the supplied photo and draft concise customer-facing copy.
3. Ask for any missing price or category. Valid categories are Pens, Stickers, Car Freshies, and Custom.
4. Call `create_listing_draft`. Attach the product image with `upload_listing_photo` when image data is available.
5. Show the user the complete proposed title, price, category, tagline, description, and photo state.
6. Do not call `publish_listing` until the user explicitly confirms that final summary.
7. Treat live updates and deletion the same way: show the exact change and obtain explicit confirmation first.

Drafts are private to the signed-in account. Publishing makes the product immediately visible on the storefront.
