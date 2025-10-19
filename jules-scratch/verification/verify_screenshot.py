
import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Navigate to the local server
        await page.goto('http://localhost:8000/index.html')

        # --- Add tasks ---
        await page.fill('#task-name', 'Task A')
        await page.click('#form-submit-button')
        await page.wait_for_selector('.gantt-bar[data-task-id="1"]')

        await page.fill('#task-name', 'Task B')
        await page.fill('#task-dependencies', '1FS')
        await page.click('#form-submit-button')

        await page.screenshot(path='jules-scratch/verification/verification.png')

        await browser.close()

asyncio.run(main())
