import { config } from "https://deno.land/x/dotenv/mod.ts";
import * as Colors from 'https://deno.land/std@0.103.0/fmt/colors.ts';

enum KeyType {
  SOURCE = 'SOURCE',
  DESTINATION = 'DESTINATION'
}

const { HAPI_KEY_SOURCE, HAPI_KEY_DESTINATION } = config({ safe: true });

export class HubSpotClient {

  private url:string = 'https://api.hubapi.com/';
  private keySource:string = HAPI_KEY_SOURCE;
  private keyDest:string = HAPI_KEY_DESTINATION;

  async request(path:string, key:KeyType, options?:RequestInit, queryStr?:string) {

    let keyParam = `?hapikey=${this.keySource}`;

    if (key == KeyType.DESTINATION) {
      keyParam = `?hapikey=${this.keyDest}`;
    }

    let endpoint = `${this.url}${path}${keyParam}`;

    if (queryStr) {
      endpoint += `${queryStr}`;
    }

    const res = await fetch(endpoint, options);

    try {
      const result = await res.json();
      return {
        status: res.status,
        ...result
      }
    } catch (error) {
      return res;
    }
  }

  async isForbidden():Promise<boolean> {
    try {
      const page = await this.request('content/api/v2/pages', KeyType.DESTINATION, undefined, '&limit=1');
      
      if (!page) {
        console.log(Colors.red('Couldn\'t reach destination api.'));
        return true;
      }

      // Only 1 will return.
      const pageObject = page.objects[0];

      /**
       * 6679661 is SungardAS production/live env.
       * 20431515 is O3 world Dev env.
       */
      switch(pageObject.portal_id) {
        case 6679661:
        case 20431515:
          return true;
      }

      return false;
    } catch (error) {
      console.log(Colors.red(error));
      return true;
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

      console.log(Colors.blue(`Creating New HubDB table: ${table.name}`))
      // Create new Table at Destination.
      const newTable = await this.request(path, KeyType.DESTINATION, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'content-type': 'application/json'
        }
      });

      if (newTable.status == '200') {
        console.log(Colors.green(`Table: ${table.name} was created successfully`));
      }

      // Get table info from source.
      const sourceTableRows = await this.request(`hubdb/api/v2/tables/${table.id}/rows`, KeyType.SOURCE);

      for(const row of sourceTableRows?.objects) {
        await this.request(`hubdb/api/v2/tables/${newTable.id}/rows`, KeyType.DESTINATION, {
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
      console.log(Colors.blue(`Deleting ${blog.name}`))
      const res = await this.request(`${path}/${blog.id}`, KeyType.DESTINATION, { method: 'DELETE' });

      if (res.status == 204) {
        console.log(Colors.green(`Successfully deleted "${blog.name}" blog.`));
      }
      
    }
  }

  async syncBlogs() {
    const path = 'content/api/v2/blogs';
    console.log(Colors.blue('Getting List of Blogs'))
    const blogs = await this.request(path, KeyType.SOURCE);
    console.log(Colors.green(`Successfully fetched list of Blogs`));

    for(const blog of blogs?.objects) {
      console.log(Colors.blue(`Syncing Blog named: ${blog.name}`))
      const res = await this.request(path, KeyType.DESTINATION, {
        method: 'POST',
        body: JSON.stringify(blog),
        headers: {
          'content-type': 'application/json'
        }
      })

      if (res?.status == 'error') {
        console.log(Colors.red(res.message));
      } else {
        console.log(Colors.green(`Blog: ${res.name} created successfully at ${res.domain_when_published}.`));
      }

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

  async syncTemplates(path:string) {
    const sourceTemplates = await this.request(path, KeyType.SOURCE);
    for (const template of sourceTemplates?.objects) {
      const res = await this.request(path, KeyType.DESTINATION, {
        method: 'POST',
        body: JSON.stringify(template),
        headers: {
          'content-type': 'application/json'
        }
      })

      if (res?.status == 'error') {
        console.log(Colors.red(res.message));
      } else {
        console.log(Colors.green(`Template ${res.path} created successfully.`));
      }
    }
  }

  async syncBlogAuthors() {
    const sourceAuthors = await this.request('blogs/v3/blog-authors', KeyType.SOURCE);

    for (const author of sourceAuthors.objects) {
      const res = await this.request('blogs/v3/blog-authors', KeyType.DESTINATION, {
        method: 'POST',
        body: JSON.stringify(author),
        headers: {
          'content-type': 'application/json'
        }
      })

      if (res?.status == 'error') {
        console.log(Colors.red(res.message));
      } else {
        console.log(Colors.green(`Author: ${res.name} created successfully at ${res.url}.`));
      }
    }

  }

  async syncBlogPosts(path:string) {
    await this.syncBlogAuthors();
    await this.syncBlogs();
    console.log(Colors.blue('Getting List of Blog Posts'))
    const blogPosts = await this.request(path, KeyType.SOURCE);
    console.log(Colors.green(`Successfully fetched list of Blog Posts`));

    for(const blogPost of blogPosts?.objects) {
      console.log(Colors.blue(`Syncing Blog post: ${blogPost.name}`))
      const parentBlog = await this.getParentBlog(blogPost.parent_blog.name);

      if(!parentBlog) continue;

      blogPost.content_group_id = parentBlog.id;

      console.log(blogPost)

      if (blogPost.translated_content) {
        for(const translated_content in blogPost.translated_content) {
          delete blogPost.translated_content[translated_content].id
        }
      }

      delete blogPost.translated_from_id;

      const res = await this.request(path, KeyType.DESTINATION, {
        method: 'POST',
        body: JSON.stringify(blogPost),
        headers: {
          'content-type': 'application/json'
        }
      })

      if (res?.status == 'error') {
        console.log(Colors.red(res.message));
      } else {
        console.log(Colors.green(`Blog Post: ${res.name} created successfully at ${res.url}.`));
      }
    }
  }

}

