import { config } from "https://deno.land/x/dotenv/mod.ts";

enum KeyType {
  SOURCE = 'SOURCE',
  DESTINATION = 'DESTINATION'
}

export default class HubSpotClient {

  private url:string = 'https://api.hubapi.com/';
  private keySource:string = config()?.HAPI_KEY_SOURCE ?? '';
  private keyDest:string = config()?.HAPI_KEY_DESTINATION ?? '';

  async request(path:string, key:KeyType, options?:RequestInit ) {

    let keyParam = `?hapikey=${this.keySource}`;

    if (key == KeyType.DESTINATION) {
      keyParam = `?hapikey=${this.keyDest}`;
    }

    const endpoint = `${this.url}${path}${keyParam}`;
    const res = await fetch(endpoint, options);

    try {
      return await res.json();
    } catch (error) {
      return res;
    }
  }

  async syncPages(path:string) {
    const pages = await this.request(path, KeyType.SOURCE);

    for(const page of pages?.objects) {
      delete page.id;
      this.request(path, KeyType.DESTINATION, {
        method: 'POST',
        body: JSON.stringify(page),
        headers: {
          'content-type': 'application/json'
        }
      });
    }
  }

  async syncHubDb(path:string) {
    const tables = await this.request(path, KeyType.SOURCE);

    for(const table of tables?.objects) {
      const payload = {
        name: table.name,
        label: table.label,
        columns: table.columns,
        createdAt: table.createdAt,
        publishedAt: table.publishedAt,
      }

      // Create new Table at Destination.
      const newTable = await this.request(path, KeyType.DESTINATION, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'content-type': 'application/json'
        }
      });

      // Get table info from source.
      const sourceTableRows = await this.request(`hubdb/api/v2/tables/${table.id}/rows`, KeyType.SOURCE);

      for(const row of sourceTableRows?.objects) {
        const newRow = await this.request(`hubdb/api/v2/tables/${newTable.id}/rows`, KeyType.DESTINATION, {
          method: 'POST',
          body: JSON.stringify({
            values: row.values
          }),
          headers: {
            'content-type': 'application/json'
          }
        });
      }
    }
  }

  async deleteBlogs() {
    const path = 'content/api/v2/blogs';
    const blogs = await this.request(path, KeyType.DESTINATION);

    for(const blog of blogs?.objects) {
      await this.request(`${path}/${blog.id}`, KeyType.DESTINATION, { method: 'DELETE' });
    }
  }

  async syncBlogs() {
    const path = 'content/api/v2/blogs';
    const blogs = await this.request(path, KeyType.SOURCE);

    for(const blog of blogs?.objects) { 
      await this.request(path, KeyType.DESTINATION, {
        method: 'POST',
        body: JSON.stringify(blog),
        headers: {
          'content-type': 'application/json'
        }
      })
    }
  }

  async getParentBlog(parentName:string) {
    const destParentBlogs = await this.request('content/api/v2/blogs', KeyType.DESTINATION);
    for(const blog of destParentBlogs?.objects) {
      if (blog.name == parentName) {
        return blog;
      }
    }
  }

  async syncBlogPosts(path:string) {
    
    await this.syncBlogs();
    const blogPosts = await this.request(path, KeyType.SOURCE);

    for(const blogPost of blogPosts?.objects) {
      const parentBlog = await this.getParentBlog(blogPost.parent_blog.name);

      if(!parentBlog) continue;

      blogPost.content_group_id = parentBlog.id;

      this.request(path, KeyType.DESTINATION, {
        method: 'POST',
        body: JSON.stringify(blogPost),
        headers: {
          'content-type': 'application/json'
        }
      })
    }
  }

}

