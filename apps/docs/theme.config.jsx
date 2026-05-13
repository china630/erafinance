const config = {
  logo: <span>ERA Finance Help Center</span>,
  project: {
    link: 'https://example.com'
  },
  docsRepositoryBase: 'https://github.com/erafinance/erafinance/tree/main/apps/docs',
  footer: {
    text: `ERA Finance Help Center ${new Date().getFullYear()}`
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s - ERA Finance Help Center'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="User documentation for ERA Finance" />
      <meta name="og:title" content="ERA Finance Help Center" />
    </>
  )
}

export default config
