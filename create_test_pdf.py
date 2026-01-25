import fitz

doc = fitz.open()

# Page 1: Title
page = doc.new_page()
page.insert_text((50, 50), "My Awesome Book", fontsize=24)
page.insert_text((50, 100), "Chapter 1: The Beginning", fontsize=18)
page.insert_text((50, 150), "This is the introduction.", fontsize=12)

# Page 2: Content
page = doc.new_page()
page.insert_text((50, 50), "Chapter 1 continues...", fontsize=12)

# Page 3: Chapter 2
page = doc.new_page()
page.insert_text((50, 50), "Chapter 2: The Middle", fontsize=18)
page.insert_text((50, 100), "Here is the core content.", fontsize=12)

# Page 4: Subchapter
page = doc.new_page()
page.insert_text((50, 50), "Section 2.1: Details", fontsize=14)

doc.save("test.pdf")
print("test.pdf created.")
