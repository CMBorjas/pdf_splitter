import PyPDF2

def split_pdf_by_chapters(pdf_file, chapters):
    pdf = PyPDF2.PdfFileReader(open(pdf_file, 'rb'))

    for chapter, (start, end) in chapters.items():
        pdf_writer = PyPDF2.PdfFileWriter()
        for page_num in range(start, end + 1):
            pdf_writer.addPage(pdf.getPage(page_num))

        with open(f'{chapter}.pdf', 'wb') as output_pdf:
            pdf_writer.write(output_pdf)

    print("PDF split into chapters successfully!")

if __name__ == "__main__":
    # Example usage
    chapters = {
        "Chapter 1": (0, 10),
        "Chapter 2": (11, 25),
        "Chapter 3": (26, 40),
        # Add more chapters as needed
    }
    split_pdf_by_chapters('textbook.pdf', chapters)
