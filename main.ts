import HubSpotClient from './hubspotClient.ts';

const args = Deno.args;

const client = new HubSpotClient();

for(const arg of args) {

  switch(arg) {
    case 'pages':
      client.syncPages('content/api/v2/pages');
      break;
    case 'hubdb':
      client.syncHubDb('hubdb/api/v2/tables');
      break;
    case 'blogs':
      client.syncBlogPosts('content/api/v2/blog-posts');
      break;
    case 'deleteBlogs':
      client.deleteBlogs();
      break;
  }

}



// const json = client.syncPages('content/api/v2/pages');