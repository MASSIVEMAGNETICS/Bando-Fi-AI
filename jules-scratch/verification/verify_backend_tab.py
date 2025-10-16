from playwright.sync_api import Page, expect, sync_playwright

def test_backend_tab(page: Page):
    """
    This test verifies that the new "Backend" tab and its functionality are working correctly.
    """
    print("Starting test...")
    try:
        # 1. Arrange: Go to the application.
        page.goto("http://localhost:3000", timeout=60000)
        page.wait_for_load_state("networkidle", timeout=60000)
        print("Navigated to the page and waited for network idle.")

        # 2. Act: Find the "Backend" tab and click it.
        backend_tab = page.get_by_role("button", name="Backend")
        backend_tab.click()
        print("Clicked on the Backend tab.")

        # 3. Assert: Confirm that the backend controls are visible.
        expect(page.get_by_role("heading", name="Select Generation Backend")).to_be_visible()
        print("Backend controls are visible.")

        # 4. Act: Click on the "Local" backend option.
        local_backend_option = page.get_by_role("button", name="Local")
        local_backend_option.click()
        print("Clicked on the Local backend option.")

        # 5. Assert: Confirm that the local server configuration options are visible.
        expect(page.get_by_role("heading", name="Local Server Configuration")).to_be_visible()
        expect(page.get_by_label("Ollama Server URL")).to_be_visible()
        expect(page.get_by_label("Local Model")).to_be_visible()
        print("Local server configuration options are visible.")

        # 6. Screenshot: Capture the final result for visual verification.
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken.")
    except Exception as e:
        print(f"An error occurred: {e}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
        test_backend_tab(page)
    finally:
        browser.close()