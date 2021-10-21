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

  private getPageByIdPath(id:number):string {
    return `content/api/v2/pages/${id}`;
  }

  /**
   * Use this function to abide by Hubspot API's rate limits
   * @param ms Time in milliseconds to wait
   */
  async sleep(ms:number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }   

  async request(path:string, key:KeyType, options?:RequestInit, queryStr?:string) {

    await this.sleep(105);

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
      const template = await this.request('content/api/v2/templates', KeyType.DESTINATION, undefined, '&limit=1');

      if (!template) {
        console.log(Colors.red('Couldn\'t reach destination api.'));
        return true;
      }

      if (template.total == 0) {
        console.log(Colors.yellow('No templatess to check againsts.'));
        return true;
      }

      // Only 1 will return.
      const templateObject = template.objects[0];

      /**
       * 6679661 is SungardAS production/live env.
       * 20431515 is O3 world Dev env.
       */
      switch(templateObject.portal_id) {
        case 6679661:
        case 20431515:
          return true;
      }

      return false;
    } catch (error) {
      console.log(Colors.red(`${error}`));
      return true;
    }
  }

  private async getDestParent(translatedFromId:number, pageId:number, listPagesPath:string) {
    // Get parent from SOURCE
    const sourceParent = await this.request(this.getPageByIdPath(translatedFromId), KeyType.SOURCE, undefined, '&limit=1');
    if (!sourceParent.name) {
      console.error(Colors.red(`Error finding parent content on source environment with ID ${pageId}.`));
      return null;
    }

    const sourceParentLang = sourceParent.language ?? 'en-us';

    // Find parent on DESTINATION (by name and lang from SOURCE page)
    const destParents = await this.request(listPagesPath, KeyType.DESTINATION, undefined, `&limit=1&name__icontains=${encodeURIComponent(sourceParent.name)}&language__in=${sourceParentLang}`);

    // Check for matches
    if (typeof destParents.objects !== 'undefined' && destParents.objects.length) {
      return destParents.objects[0];
    }
    return null;
  }

  async syncPages(path:string) {
    const pages = await this.request(path, KeyType.SOURCE, undefined, '&limit=100');
    const orphanedTranslations = [];

    for(const page of pages?.objects) {
      // Check if this is a translation of another page or a parent page
      if (page.translated_from_id) {
        const destParent = await this.getDestParent(page.translated_from_id, page.id, path);

        // Assign parent to translation if match is found, otherwise, defer for later (parent may not have been created on DESTINATION yet)
        if (destParent) {
          page.translated_from_id = destParent.id;
        } else {
          orphanedTranslations.push(page);
          continue;
        }
      }

      delete page.id;
      await this.request(path, KeyType.DESTINATION, {
        method: 'POST',
        body: JSON.stringify(page),
        headers: {
          'content-type': 'application/json'
        }
      });
    }

    // Process orphaned translations queue
    for (const page of orphanedTranslations) {
      // Attempt to get parent from dev (by name and lang)
      const destParent = await this.getDestParent(page.translated_from_id, page.id, path);

      // Assign parent to translation if match is found, otherwise, log
      if (destParent) {
        page.translated_from_id = destParent.id;
        delete page.id;
        await this.request(path, KeyType.DESTINATION, {
          method: 'POST',
          body: JSON.stringify(page),
          headers: {
            'content-type': 'application/json'
          }
        });
      } else {
        console.error(Colors.red(`Unable to create page with live ID: ${page.id}`));
      }
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

    // Skipping translated content.
    const mainBlogs = blogs.objects.filter((blog: any) => blog.translated_from_id == null ? true : false);

    for (const mainBlog of mainBlogs) {

        const payload = {
          name: mainBlog.name,
          category_id: mainBlog.category_id,
          created: mainBlog.created,
          updated: mainBlog.updated,
          item_template_path: mainBlog.item_template_path,
          public_title: mainBlog.public_title,
          html_title: mainBlog.html_title,
          slug: mainBlog.slug,
          description: mainBlog.description,
          language: mainBlog.language,
        };
        
        const res = await this.request(path, KeyType.DESTINATION, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'content-type': 'application/json'
          }
        });

        if (res?.status == 'error') {
          return console.log(Colors.red(res.message));
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
    const destinationTemplates = await this.request(path, KeyType.DESTINATION);

    let templatesToSync = [];

    for (const sourceTemplate of sourceTemplates?.objects) {
      for (const destinationTemplate of destinationTemplates?.objects) {
        if (sourceTemplates.id == destinationTemplates.id) continue;
        templatesToSync.push(sourceTemplate);
      }
    }

    for (const template of templatesToSync) {
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

    // Get blog author ID for `Sungard AS` user since ID's aren't the same between environments
    const destinationAuthors = await this.request('blogs/v3/blog-authors', KeyType.DESTINATION);
    const sungardAsAuthorId = destinationAuthors.objects.find((author: any) => author.displayName == 'Sungard AS').id;

    console.log(Colors.blue('Getting List of Blog Posts'))
    const blogPosts = await this.request(path, KeyType.SOURCE, undefined, '&limit=200');
    console.log(Colors.green(`Successfully fetched list of Blog Posts`));

    for(const blogPost of blogPosts?.objects) {
      const parentBlog = await this.getParentBlog(blogPost.parent_blog.name);
      if (!parentBlog) continue;
      blogPost.content_group_id = parentBlog.id;

      // Set blog author ID to `Sungard AS` user since ID's aren't the same between environments
      blogPost.blog_author_id = sungardAsAuthorId;

      // Skipping translated content for now.
      if (blogPost?.translated_from_id) continue;

      console.log(Colors.blue(`Syncing Blog post: ${blogPost.name}`))

      const res = await this.request(path, KeyType.DESTINATION, {
        method: 'POST',
        body: JSON.stringify(blogPost),
        headers: {
          'content-type': 'application/json'
        }
      });

      if (res?.status == 'error') {
        console.log(Colors.red(res.message));
      } else {
        console.log(Colors.green(`Blog Post: ${res.name} created successfully at ${res.url}.`));
      }
    }
  }

}

