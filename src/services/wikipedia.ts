export async function fetchBirdImage(birdName: string): Promise<string | null> {
  try {
    // Format the bird name for the Wikipedia API (e.g., "American Robin" -> "American_Robin")
    const formattedName = encodeURIComponent(birdName.trim().replace(/ /g, '_'));
    
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${formattedName}&prop=pageimages&format=json&pithumbsize=500&origin=*`
    );
    
    const data = await response.json();
    const pages = data.query?.pages;
    
    if (pages) {
      const pageId = Object.keys(pages)[0];
      if (pageId !== '-1' && pages[pageId].thumbnail) {
        return pages[pageId].thumbnail.source;
      }
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch image for ${birdName}:`, error);
    return null;
  }
}
